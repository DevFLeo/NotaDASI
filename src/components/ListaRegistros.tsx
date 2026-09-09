import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import BarraBusca from './BarraBusca';
import ContatoProtegido from './ContatoProtegido';
import NotaBuscaRapida from '../native/NotaBuscaRapida';
import { carregarRegistros, obterOrigemDados } from '../data/fonte';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  textoPesquisavel,
  type Registro,
} from '../data/registros';

const registroCorresponde = async (registro: Registro, termoBusca: string): Promise<boolean> => {
  const ocorrencias = await NotaBuscaRapida.buscarOcorrencias(
    textoPesquisavel(registro),
    termoBusca,
  );

  return ocorrencias.length > 0;
};

const resumir = (texto: string, limite = 130): string =>
  texto.length <= limite ? texto : `${texto.slice(0, limite).trimEnd()}...`;

/** Selo Sim/Não/— para as respostas booleanas do levantamento. */
const Indicador: React.FC<{ rotulo: string; valor?: boolean }> = ({ rotulo, valor }) => {
  const cor = valor === true ? '#6EE7B7' : valor === false ? '#FCA5A5' : '#64748b';
  const texto = valor === true ? 'Sim' : valor === false ? 'Não' : '—';

  return (
    <View style={estilos.indicador}>
      <Text style={estilos.rotuloIndicador}>{rotulo}</Text>
      <Text style={[estilos.valorIndicador, { color: cor }]}>{texto}</Text>
    </View>
  );
};

type PropsCartao = {
  registro: Registro;
  indice: number;
  aoSelecionar: (registro: Registro) => void;
};

const CartaoRegistro: React.FC<PropsCartao> = ({ registro, indice, aoSelecionar }) => {
  const situacao = calcularSituacao(registro);
  const cor = corPorSituacao[situacao];

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(indice, 8) * 60).springify()}
      layout={LinearTransition.springify()}
      style={[estilos.cartao, { borderColor: `${cor}55` }]}>
      <Pressable
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
        onPress={() => aoSelecionar(registro)}
        style={estilos.areaCartao}>
        <View style={estilos.cabecalhoCartao}>
          <View style={[estilos.selo, { backgroundColor: `${cor}22` }]}>
            <Text style={[estilos.textoSelo, { color: cor }]}>{rotuloSituacao[situacao]}</Text>
          </View>

          <View style={estilos.seloSetor}>
            <Text style={estilos.textoSeloSetor}>{registro.setorSigla || registro.setor}</Text>
          </View>
        </View>

        <Text style={estilos.competencia}>{resumir(registro.competencia)}</Text>

        {registro.comoAtende ? (
          <Text style={estilos.comoAtende}>{resumir(registro.comoAtende, 110)}</Text>
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

type Props = {
  aoSelecionar?: (registro: Registro) => void;
};

const ListaRegistros: React.FC<Props> = ({ aoSelecionar }) => {
  const registros = useMemo(() => carregarRegistros(), []);
  const origem = useMemo(() => obterOrigemDados(), []);

  const [termoBusca, setTermoBusca] = useState('');
  const [setorFiltro, setSetorFiltro] = useState<string | null>(null);
  const [idsCorrespondentes, setIdsCorrespondentes] = useState<string[] | null>(null);

  const setores = useMemo(
    () => [...new Set(registros.map((r) => r.setorSigla || r.setor))].filter(Boolean).sort(),
    [registros],
  );

  const executarBusca = useCallback(
    async (termo: string) => {
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

        setIdsCorrespondentes(resultados.filter((id): id is string => id !== null));
      } catch {
        setIdsCorrespondentes(null);
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

      return passouBusca && passouFiltro;
    });
  }, [registros, idsCorrespondentes, setorFiltro]);

  const abrir = useCallback(
    (registro: Registro) => {
      aoSelecionar?.(registro);
    },
    [aoSelecionar],
  );

  const renderizar = useCallback(
    ({ item, index }: ListRenderItemInfo<Registro>) => (
      <CartaoRegistro registro={item} indice={index} aoSelecionar={abrir} />
    ),
    [abrir],
  );

  const departamento = registros[0]?.departamentoSigla ?? '';

  return (
    <View style={estilos.container}>
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
          contentContainerStyle={estilos.faixaFiltros}>
          <Pressable
            onPress={() => setSetorFiltro(null)}
            style={[estilos.chip, setorFiltro === null && estilos.chipAtivo]}>
            <Text style={[estilos.textoChip, setorFiltro === null && estilos.textoChipAtivo]}>
              Todos
            </Text>
          </Pressable>

          {setores.map((sigla) => {
            const ativo = setorFiltro === sigla;
            return (
              <Pressable
                key={sigla}
                onPress={() => setSetorFiltro(ativo ? null : sigla)}
                style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <Text style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}>{sigla}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {visiveis.length === 0 ? (
        <View style={estilos.estadoVazio}>
          <Text style={estilos.textoEstadoVazio}>
            Nenhuma competência encontrada
            {termoBusca ? ` para "${termoBusca}"` : ''}
            {setorFiltro ? ` em ${setorFiltro}` : ''}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(registro) => registro.id}
          renderItem={renderizar}
          contentContainerStyle={estilos.conteudoLista}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111f' },
  cabecalho: { paddingHorizontal: 20, paddingTop: 12 },
  titulo: { color: '#f8fafc', fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitulo: { marginTop: 4, marginBottom: 16, color: '#94a3b8', fontSize: 13 },
  faixaFiltros: { gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  chipAtivo: { backgroundColor: 'rgba(37, 99, 235, 0.22)', borderColor: '#2563EB' },
  textoChip: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  textoChipAtivo: { color: '#dbeafe' },
  conteudoLista: { paddingHorizontal: 18, paddingBottom: 30 },
  cartao: {
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 24, 40, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 6,
  },
  areaCartao: { padding: 18 },
  cabecalhoCartao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selo: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  textoSelo: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  seloSetor: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  textoSeloSetor: { color: '#cbd5e1', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  competencia: { color: '#f8fafc', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  comoAtende: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 8 },
  blocoResponsavel: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
  },
  nomeResponsavel: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  cargoResponsavel: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  faixaIndicadores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  indicador: { flex: 1, alignItems: 'center' },
  rotuloIndicador: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valorIndicador: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  linhaCamada: { color: '#94a3b8', fontSize: 11, marginTop: 12 },
  avisoProblema: {
    marginTop: 12,
    backgroundColor: 'rgba(249, 168, 212, 0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  textoAvisoProblema: { color: '#F9A8D4', fontSize: 11, lineHeight: 17 },
  estadoVazio: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  textoEstadoVazio: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
});

export default ListaRegistros;
