import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import BarraBusca from './BarraBusca';
import ContatoProtegido from './ContatoProtegido';
import NotaBuscaRapida from '../native/NotaBuscaRapida';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  textoPesquisavel,
  type Registro,
} from '../data/registros';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useMetricas, useTema } from '../tema/ThemeContext';

const registroCorresponde = async (registro: Registro, termoBusca: string): Promise<boolean> => {
  const ocorrencias = await NotaBuscaRapida.buscarOcorrencias(
    textoPesquisavel(registro),
    termoBusca,
  );

  return ocorrencias.length > 0;
};

const resumir = (texto: string, limite: number): string =>
  texto.length <= limite ? texto : `${texto.slice(0, limite).trimEnd()}...`;

/** Selo Sim/Não/— para as respostas booleanas do levantamento. */
const Indicador: React.FC<{ rotulo: string; valor?: boolean }> = ({ rotulo, valor }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosLista);
  const cor = valor === true ? tema.sucesso : valor === false ? tema.erro : tema.textoTerciario;
  const texto = valor === true ? 'Sim' : valor === false ? 'Não' : '—';

  return (
    <View style={estilos.indicador}>
      <Text
        style={estilos.rotuloIndicador}
        numberOfLines={1}
        maxFontSizeMultiplier={metricas.fonteMaxDensa}>
        {rotulo}
      </Text>
      <Text
        style={[estilos.valorIndicador, { color: cor }]}
        maxFontSizeMultiplier={metricas.fonteMaxDensa}>
        {texto}
      </Text>
    </View>
  );
};

type PropsCartao = {
  registro: Registro;
  indice: number;
  aoSelecionar: (registro: Registro) => void;
  aoAlternarFavorito: (registro: Registro) => void;
};

const CartaoRegistroBase: React.FC<PropsCartao> = ({
  registro,
  indice,
  aoSelecionar,
  aoAlternarFavorito,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosLista);
  const situacao = calcularSituacao(registro);
  const cor = corPorSituacao[situacao];

  // Em coluna dupla/tripla cabe menos texto por cartão do que em coluna única.
  const limiteCompetencia = metricas.colunas > 1 ? 90 : 130;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(indice, 8) * 60).springify()}
      layout={LinearTransition.springify()}
      style={[estilos.itemGrade, estilos.cartao, { borderColor: `${cor}55` }]}>
      <Pressable
        android_ripple={{ color: tema.superficieAtiva }}
        onPress={() => aoSelecionar(registro)}
        accessibilityRole="button"
        accessibilityLabel={`${rotuloSituacao[situacao]}. ${registro.competencia}`}
        style={estilos.areaCartao}>
        <View style={estilos.cabecalhoCartao}>
          <View style={[estilos.selo, { backgroundColor: `${cor}22` }]}>
            <Text
              style={[estilos.textoSelo, { color: cor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={metricas.fonteMaxDensa}>
              {rotuloSituacao[situacao]}
            </Text>
          </View>

          <View style={estilos.grupoDireitaCabecalho}>
            <View style={estilos.seloSetor}>
              <Text
                style={estilos.textoSeloSetor}
                numberOfLines={1}
                maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                {registro.setorSigla || registro.setor}
              </Text>
            </View>

            <Pressable
              onPress={() => aoAlternarFavorito(registro)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={registro.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
              <Text style={estilos.estrela}>{registro.favorito ? '★' : '☆'}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={estilos.competencia}>{resumir(registro.competencia, limiteCompetencia)}</Text>

        {registro.comoAtende ? (
          <Text style={estilos.comoAtende} numberOfLines={metricas.colunas > 1 ? 3 : undefined}>
            {resumir(registro.comoAtende, 110)}
          </Text>
        ) : null}

        <View style={estilos.blocoResponsavel}>
          <Text style={estilos.nomeResponsavel}>{registro.responsavel || '—'}</Text>
          <Text style={estilos.cargoResponsavel}>
            {[registro.cargo, registro.setor].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={estilos.faixaIndicadores}>
          <Indicador rotulo="Atende" valor={registro.sistemaAtende} />
          <Indicador rotulo="Treinado" valor={registro.houveTreinamento} />
          <Indicador rotulo="Acesso" valor={registro.acessoCamadaConcedido} />
          <Indicador rotulo="Iniciou" valor={registro.iniciouAtividade} />
        </View>

        {(registro.informacoesAcessadas || registro.nivelAcessoCamada) && (
          <Text style={estilos.linhaCamada}>
            Camada: {registro.informacoesAcessadas || '—'}
            {registro.nivelAcessoCamada ? ` (${registro.nivelAcessoCamada})` : ''}
          </Text>
        )}

        {registro.temProblema === true && (
          <View style={estilos.avisoProblema}>
            <Text style={estilos.textoAvisoProblema}>
              ⚠ {registro.detalheProblema || 'Problema relatado no SIG'}
              {registro.temChamado === false ? ' · sem chamado aberto' : ''}
            </Text>
          </View>
        )}

        <ContatoProtegido contato={registro.contatoPessoal} />
      </Pressable>
    </Animated.View>
  );
};

/**
 * Sem o memo, digitar na busca re-renderizava TODOS os cartões a cada tecla
 * (a lista inteira continua montada enquanto o filtro roda em segundo plano).
 */
const CartaoRegistro = React.memo(CartaoRegistroBase);

type Props = {
  registros: Registro[];
  origem: 'planilha' | 'exemplo';
  aoSelecionar?: (registro: Registro) => void;
  aoAlternarFavorito: (registro: Registro) => void;
  aoCriar: () => void;
};

const ListaRegistros: React.FC<Props> = ({
  registros,
  origem,
  aoSelecionar,
  aoAlternarFavorito,
  aoCriar,
}) => {
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosLista);

  const [termoBusca, setTermoBusca] = useState('');
  const [setorFiltro, setSetorFiltro] = useState<string | null>(null);
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);
  const [idsCorrespondentes, setIdsCorrespondentes] = useState<string[] | null>(null);

  const setores = useMemo(
    () => [...new Set(registros.map((r) => r.setorSigla || r.setor))].filter(Boolean).sort(),
    [registros],
  );

  // A busca é assíncrona (passa pelo módulo nativo). Sem este contador, uma
  // busca lenta que termina depois de uma mais recente sobrescreveria o
  // resultado certo pelo antigo.
  const buscaAtual = useRef(0);

  const executarBusca = useCallback(
    async (termo: string) => {
      const identificador = buscaAtual.current + 1;
      buscaAtual.current = identificador;

      const termoNormalizado = termo.trim();

      if (!termoNormalizado) {
        setIdsCorrespondentes(null);
        return;
      }

      try {
        const resultados = await Promise.all(
          registros.map(async (registro) =>
            (await registroCorresponde(registro, termoNormalizado)) ? registro.id : null,
          ),
        );

        if (buscaAtual.current !== identificador) {
          return;
        }

        setIdsCorrespondentes(resultados.filter((id): id is string => id !== null));
      } catch {
        if (buscaAtual.current === identificador) {
          setIdsCorrespondentes(null);
        }
      }
    },
    [registros],
  );

  useEffect(() => {
    const temporizador = setTimeout(() => {
      executarBusca(termoBusca);
    }, 250);

    return () => clearTimeout(temporizador);
  }, [termoBusca, executarBusca]);

  const visiveis = useMemo(() => {
    const conjunto = idsCorrespondentes === null ? null : new Set(idsCorrespondentes);

    return registros.filter((registro) => {
      const passouBusca = conjunto === null || conjunto.has(registro.id);
      const passouFiltro =
        setorFiltro === null || (registro.setorSigla || registro.setor) === setorFiltro;
      const passouFavoritos = !somenteFavoritos || registro.favorito === true;

      return passouBusca && passouFiltro && passouFavoritos;
    });
  }, [registros, idsCorrespondentes, setorFiltro, somenteFavoritos]);

  const abrir = useCallback(
    (registro: Registro) => {
      aoSelecionar?.(registro);
    },
    [aoSelecionar],
  );

  const renderizar = useCallback(
    ({ item, index }: ListRenderItemInfo<Registro>) => (
      <CartaoRegistro
        registro={item}
        indice={index}
        aoSelecionar={abrir}
        aoAlternarFavorito={aoAlternarFavorito}
      />
    ),
    [abrir, aoAlternarFavorito],
  );

  const departamento = registros[0]?.departamentoSigla ?? '';

  const cabecalho = (
    <Animated.View entering={FadeInUp.duration(400)} style={estilos.cabecalho}>
      <Text style={estilos.titulo}>Levantamento SIG</Text>
      <Text style={estilos.subtitulo}>
        {departamento ? `${departamento} · ` : ''}
        {visiveis.length} de {registros.length} competências
        {origem === 'exemplo' ? ' · dados de exemplo' : ''}
      </Text>

      <BarraBusca
        valor={termoBusca}
        aoAlterar={setTermoBusca}
        aoPesquisar={() => executarBusca(termoBusca)}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={estilos.rolagemFiltros}
        contentContainerStyle={estilos.faixaFiltros}>
        <Pressable
          onPress={() => setSetorFiltro(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: setorFiltro === null }}
          style={[estilos.chip, setorFiltro === null && estilos.chipAtivo]}>
          <Text
            style={[estilos.textoChip, setorFiltro === null && estilos.textoChipAtivo]}
            maxFontSizeMultiplier={metricas.fonteMaxDensa}>
            Todos
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setSomenteFavoritos((atual) => !atual)}
          accessibilityRole="button"
          accessibilityState={{ selected: somenteFavoritos }}
          style={[estilos.chip, somenteFavoritos && estilos.chipAtivo]}>
          <Text
            style={[estilos.textoChip, somenteFavoritos && estilos.textoChipAtivo]}
            maxFontSizeMultiplier={metricas.fonteMaxDensa}>
            ★ Favoritos
          </Text>
        </Pressable>

        {setores.map((sigla) => {
          const ativo = setorFiltro === sigla;
          return (
            <Pressable
              key={sigla}
              onPress={() => setSetorFiltro(ativo ? null : sigla)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={[estilos.chip, ativo && estilos.chipAtivo]}>
              <Text
                style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}
                maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                {sigla}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const vazio = (
    <View style={estilos.estadoVazio}>
      <Text style={estilos.textoEstadoVazio}>
        Nenhuma competência encontrada
        {termoBusca ? ` para "${termoBusca}"` : ''}
        {setorFiltro ? ` em ${setorFiltro}` : ''}
        {somenteFavoritos ? ' nos favoritos' : ''}.
      </Text>
    </View>
  );

  return (
    <View style={estilos.container}>
      <FlatList
        // A FlatList não aceita mudar numColumns em tempo de execução; trocar a
        // key força a remontagem quando o aparelho gira ou muda de janela.
        key={`colunas-${metricas.colunas}`}
        data={visiveis}
        keyExtractor={(registro) => registro.id}
        renderItem={renderizar}
        numColumns={metricas.colunas}
        columnWrapperStyle={metricas.colunas > 1 ? estilos.linhaGrade : undefined}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={vazio}
        contentContainerStyle={estilos.conteudoLista}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      <Pressable
        onPress={aoCriar}
        style={estilos.fab}
        accessibilityRole="button"
        accessibilityLabel="Adicionar nova competência">
        <Text style={estilos.textoFab}>+</Text>
      </Pressable>
    </View>
  );
};

const criarEstilosLista = criarEstilos((tema, m) => ({
  container: { flex: 1, backgroundColor: tema.fundo },
  cabecalho: { paddingTop: 12 },
  titulo: {
    color: tema.texto,
    fontSize: m.compacta ? 24 : m.expandida ? 32 : 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitulo: { marginTop: 4, marginBottom: 16, color: tema.textoSecundario, fontSize: 13 },
  // A faixa de filtros sangra até as bordas da janela (margem negativa) para
  // que o último chip não pareça cortado antes do fim da tela.
  rolagemFiltros: { marginHorizontal: -m.margem },
  faixaFiltros: { gap: 8, paddingBottom: 14, paddingHorizontal: m.margem },
  chip: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chipAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
  textoChip: { color: tema.textoSecundario, fontSize: 12, fontWeight: '600' },
  textoChipAtivo: { color: tema.primariaTexto },
  // Em telas largas o conteúdo para de esticar e fica centralizado: linhas de
  // texto muito longas cansam a leitura, e a grade já usa a largura extra.
  conteudoLista: {
    width: '100%',
    maxWidth: m.colunas > 1 ? 1200 : m.larguraMaxConteudo,
    alignSelf: 'center',
    paddingHorizontal: m.margem,
    paddingBottom: 96,
  },
  linhaGrade: { gap: m.espaco },
  // Em coluna única o cartão já ocupa a linha inteira; só a grade precisa
  // repartir a largura. O maxWidth impede que um item órfão na última linha
  // estique e fique com o dobro do tamanho dos vizinhos.
  itemGrade: m.colunas > 1 ? { flex: 1, maxWidth: `${100 / m.colunas}%` } : {},
  cartao: {
    borderRadius: 22,
    marginBottom: m.espaco,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: tema.fundoElevado,
    shadowColor: tema.sombra,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: tema.modo === 'escuro' ? 0.26 : 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  areaCartao: { padding: m.compacta ? 14 : 18 },
  cabecalhoCartao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selo: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  textoSelo: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  grupoDireitaCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  estrela: { fontSize: 18, color: tema.favorito },
  seloSetor: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tema.superficie,
  },
  textoSeloSetor: { color: tema.textoSecundario, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  competencia: { color: tema.texto, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  comoAtende: { color: tema.textoSecundario, fontSize: 12, lineHeight: 18, marginTop: 8 },
  blocoResponsavel: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  nomeResponsavel: { color: tema.texto, fontSize: 14, fontWeight: '600' },
  cargoResponsavel: { color: tema.textoSecundario, fontSize: 12, marginTop: 2 },
  faixaIndicadores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 6,
  },
  indicador: { flex: 1, alignItems: 'center' },
  rotuloIndicador: {
    color: tema.textoTerciario,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valorIndicador: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  linhaCamada: { color: tema.textoSecundario, fontSize: 11, marginTop: 12 },
  avisoProblema: {
    marginTop: 12,
    backgroundColor: tema.problemaFundo,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  textoAvisoProblema: { color: tema.problema, fontSize: 11, lineHeight: 17 },
  estadoVazio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  textoEstadoVazio: { color: tema.textoSecundario, fontSize: 14, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: m.margem,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tema.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: tema.sombra,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  textoFab: { color: tema.textoInvertido, fontSize: 28, fontWeight: '600', lineHeight: 30 },
}));

export default ListaRegistros;
