import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, LinearTransition, runOnJS, useSharedValue } from 'react-native-reanimated';
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
import { criarEstilosEscalaveis } from '../tema/estilos';
import { limitarEscalaTexto } from '../tema/responsivo';
import { useEscalaTexto, useEstilos, useMetricas, useTema } from '../tema/ThemeContext';

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

  const limiteCompetencia = metricas.colunas > 1 ? 90 : 130;

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(indice, 8) * 60).springify()}
      layout={LinearTransition.springify()}
      style={[estilos.itemGrade, estilos.cartao, { borderColor: `${cor}55` }]}>
      <Pressable
        android_ripple={{ color: tema.superficieAtiva }}
        onPress={() => aoSelecionar(registro)}
        {...(Platform.OS === 'web' ? { onDoubleClick: () => aoSelecionar(registro) } : {})}
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
  const tema = useTema();
  const estilos = useEstilos(criarEstilosLista);
  const [escalaTexto, definirEscalaTexto] = useEscalaTexto();

  const [modoVisualizacao, setModoVisualizacao] = useState<'cartoes' | 'tabela'>('cartoes');
  const [termoBusca, setTermoBusca] = useState('');
  const [secretariaFiltro, setSecretariaFiltro] = useState<string | null>(null);
  const [setorFiltro, setSetorFiltro] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'atendido' | 'pendente' | 'problema' | 'favoritos'>('todos');
  const [idsCorrespondentes, setIdsCorrespondentes] = useState<string[] | null>(null);

  // Ordenação na visão de tabela
  const [ordemColuna, setOrdemColuna] = useState<'secretaria' | 'setor' | 'situacao' | 'competencia'>('secretaria');
  const [ordemAscendente, setOrdemAscendente] = useState(true);

  // Lista única de Secretarias do município
  const secretarias = useMemo(() => {
    const s = new Set<string>();
    registros.forEach((r) => {
      const sec = r.departamentoSigla || r.departamento;
      if (sec) s.add(sec.trim().toUpperCase());
    });
    return Array.from(s).sort();
  }, [registros]);

  // Lista única de Setores (filtrados pela secretaria se houver)
  const setores = useMemo(() => {
    const filtrados = secretariaFiltro
      ? registros.filter((r) => (r.departamentoSigla || r.departamento)?.trim().toUpperCase() === secretariaFiltro)
      : registros;
    return [...new Set(filtrados.map((r) => r.setorSigla || r.setor))].filter(Boolean).sort();
  }, [registros, secretariaFiltro]);

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
          registros.map(async (r) => {
            const matches = await NotaBuscaRapida.buscarOcorrencias(textoPesquisavel(r), termoNormalizado);
            return matches.length > 0 ? r.id : null;
          }),
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

    let lista = registros.filter((registro) => {
      const passouBusca = conjunto === null || conjunto.has(registro.id);
      const sec = (registro.departamentoSigla || registro.departamento)?.trim().toUpperCase();
      const passouSecretaria = secretariaFiltro === null || sec === secretariaFiltro;
      const passouSetor = setorFiltro === null || (registro.setorSigla || registro.setor) === setorFiltro;

      let passouStatus = true;
      if (statusFiltro === 'atendido') passouStatus = registro.sistemaAtende === true;
      else if (statusFiltro === 'pendente') passouStatus = registro.sistemaAtende === false;
      else if (statusFiltro === 'problema') passouStatus = registro.temProblema === true;
      else if (statusFiltro === 'favoritos') passouStatus = registro.favorito === true;

      return passouBusca && passouSecretaria && passouSetor && passouStatus;
    });

    if (modoVisualizacao === 'tabela') {
      lista = [...lista].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (ordemColuna === 'secretaria') {
          valA = a.departamentoSigla || a.departamento || '';
          valB = b.departamentoSigla || b.departamento || '';
        } else if (ordemColuna === 'setor') {
          valA = a.setorSigla || a.setor || '';
          valB = b.setorSigla || b.setor || '';
        } else if (ordemColuna === 'situacao') {
          valA = rotuloSituacao[calcularSituacao(a)];
          valB = rotuloSituacao[calcularSituacao(b)];
        } else if (ordemColuna === 'competencia') {
          valA = a.competencia || '';
          valB = b.competencia || '';
        }
        const cmp = valA.localeCompare(valB, 'pt-BR');
        return ordemAscendente ? cmp : -cmp;
      });
    }

    return lista;
  }, [registros, idsCorrespondentes, secretariaFiltro, setorFiltro, statusFiltro, modoVisualizacao, ordemColuna, ordemAscendente]);

  const alternarOrdem = (coluna: typeof ordemColuna) => {
    if (ordemColuna === coluna) {
      setOrdemAscendente((prev) => !prev);
    } else {
      setOrdemColuna(coluna);
      setOrdemAscendente(true);
    }
  };

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

  const escalaAoIniciar = useSharedValue(escalaTexto);
  const escalaAplicada = useSharedValue(escalaTexto);

  const gestoPinca = Gesture.Pinch()
    .onBegin(() => {
      escalaAoIniciar.value = escalaAplicada.value;
    })
    .onChange((evento) => {
      const proxima = limitarEscalaTexto(escalaAoIniciar.value * evento.scale);
      if (proxima !== escalaAplicada.value) {
        escalaAplicada.value = proxima;
        runOnJS(definirEscalaTexto)(proxima);
      }
    });

  useEffect(() => {
    escalaAplicada.value = escalaTexto;
  }, [escalaTexto, escalaAplicada]);

  const cabecalho = (
    <Animated.View entering={FadeInUp.duration(400)} style={estilos.cabecalho}>
      <View style={estilos.linhaTituloTopo}>
        <View>
          <Text style={estilos.titulo}>Levantamento SIG</Text>
          <Text style={estilos.subtitulo}>
            {visiveis.length} de {registros.length} competências
            {secretariaFiltro ? ` em ${secretariaFiltro}` : ''}
            {origem === 'exemplo' ? ' · dados de exemplo' : ''}
          </Text>
        </View>

        {/* Alternador de Visão no PC (Cartões vs Tabela) */}
        <View style={estilos.alternadorModoVisao}>
          <Pressable
            onPress={() => setModoVisualizacao('cartoes')}
            style={[
              estilos.botaoModoVisao,
              modoVisualizacao === 'cartoes' && estilos.botaoModoVisaoAtivo,
            ]}>
            <Text
              style={[
                estilos.textoModoVisao,
                modoVisualizacao === 'cartoes' && estilos.textoModoVisaoAtivo,
              ]}>
              🗇 Cartões
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setModoVisualizacao('tabela')}
            style={[
              estilos.botaoModoVisao,
              modoVisualizacao === 'tabela' && estilos.botaoModoVisaoAtivo,
            ]}>
            <Text
              style={[
                estilos.textoModoVisao,
                modoVisualizacao === 'tabela' && estilos.textoModoVisaoAtivo,
              ]}>
              ☷ Tabela
            </Text>
          </Pressable>
        </View>
      </View>

      <BarraBusca
        valor={termoBusca}
        aoAlterar={setTermoBusca}
        aoPesquisar={() => executarBusca(termoBusca)}
      />

      {/* Faixa 1: Filtros de Situação */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={estilos.rolagemFiltros}
        contentContainerStyle={estilos.faixaFiltros}>
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'atendido', label: '✓ Atendido' },
          { id: 'pendente', label: '⏳ Pendente' },
          { id: 'problema', label: '⚠ Problemas' },
          { id: 'favoritos', label: '★ Favoritos' },
        ].map((f) => {
          const ativo = statusFiltro === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setStatusFiltro(f.id as any)}
              style={[estilos.chip, ativo && estilos.chipAtivo]}>
              <Text style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Faixa 2: Filtros de Secretaria Municipal */}
      {secretarias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={[estilos.rolagemFiltros, { marginTop: 4 }]}
          contentContainerStyle={estilos.faixaFiltros}>
          <Pressable
            onPress={() => {
              setSecretariaFiltro(null);
              setSetorFiltro(null);
            }}
            style={[estilos.chip, secretariaFiltro === null && estilos.chipAtivo]}>
            <Text style={[estilos.textoChip, secretariaFiltro === null && estilos.textoChipAtivo]}>
              Todas as Secretarias
            </Text>
          </Pressable>

          {secretarias.map((sec) => {
            const ativo = secretariaFiltro === sec;
            return (
              <Pressable
                key={sec}
                onPress={() => {
                  setSecretariaFiltro(ativo ? null : sec);
                  setSetorFiltro(null);
                }}
                style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <Text style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}>
                  {sec}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Faixa 3: Filtro de Setores (se secretaria selecionada ou geral) */}
      {setores.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={[estilos.rolagemFiltros, { marginTop: 4 }]}
          contentContainerStyle={estilos.faixaFiltros}>
          <Pressable
            onPress={() => setSetorFiltro(null)}
            style={[estilos.chipPequeno, setorFiltro === null && estilos.chipPequenoAtivo]}>
            <Text style={[estilos.textoChipPequeno, setorFiltro === null && estilos.textoChipPequenoAtivo]}>
              Todos os Setores
            </Text>
          </Pressable>

          {setores.map((sigla) => {
            const ativo = setorFiltro === sigla;
            return (
              <Pressable
                key={sigla}
                onPress={() => setSetorFiltro(ativo ? null : sigla)}
                style={[estilos.chipPequeno, ativo && estilos.chipPequenoAtivo]}>
                <Text style={[estilos.textoChipPequeno, ativo && estilos.textoChipPequenoAtivo]}>
                  {sigla}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Animated.View>
  );

  const vazio = (
    <View style={estilos.estadoVazio}>
      <Text style={estilos.textoEstadoVazio}>
        Nenhuma competência encontrada
        {termoBusca ? ` para "${termoBusca}"` : ''}
        {secretariaFiltro ? ` na ${secretariaFiltro}` : ''}
        {setorFiltro ? ` em ${setorFiltro}` : ''}
        {statusFiltro !== 'todos' ? ` com filtro de status` : ''}.
      </Text>
    </View>
  );

  return (
    <View style={estilos.container}>
      {modoVisualizacao === 'cartoes' ? (
        <GestureDetector gesture={gestoPinca}>
          <FlatList
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
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={9}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        </GestureDetector>
      ) : (
        /* VISÃO DE TABELA DE ALTA DENSIDADE NO PC */
        <ScrollView
          style={estilos.containerTabela}
          contentContainerStyle={estilos.conteudoTabela}
          showsVerticalScrollIndicator>
          {cabecalho}

          <View style={estilos.tabelaWrapper}>
            {/* Linha de Cabeçalho da Tabela */}
            <View style={estilos.tabelaLinhaHeader}>
              <Pressable
                onPress={() => alternarOrdem('situacao')}
                style={[estilos.colunaHeader, { width: 90 }]}>
                <Text style={estilos.textoHeaderCol}>
                  SITUAÇÃO {ordemColuna === 'situacao' ? (ordemAscendente ? '▲' : '▼') : ''}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => alternarOrdem('secretaria')}
                style={[estilos.colunaHeader, { width: 85 }]}>
                <Text style={estilos.textoHeaderCol}>
                  SEC {ordemColuna === 'secretaria' ? (ordemAscendente ? '▲' : '▼') : ''}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => alternarOrdem('setor')}
                style={[estilos.colunaHeader, { width: 80 }]}>
                <Text style={estilos.textoHeaderCol}>
                  SETOR {ordemColuna === 'setor' ? (ordemAscendente ? '▲' : '▼') : ''}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => alternarOrdem('competencia')}
                style={[estilos.colunaHeader, { flex: 1, minWidth: 160 }]}>
                <Text style={estilos.textoHeaderCol}>
                  COMPETÊNCIA {ordemColuna === 'competencia' ? (ordemAscendente ? '▲' : '▼') : ''}
                </Text>
              </Pressable>

              <View style={[estilos.colunaHeader, { width: 75, alignItems: 'center' }]}>
                <Text style={estilos.textoHeaderCol}>ATENDE</Text>
              </View>

              <View style={[estilos.colunaHeader, { width: 80, alignItems: 'center' }]}>
                <Text style={estilos.textoHeaderCol}>TREINADO</Text>
              </View>

              <View style={[estilos.colunaHeader, { width: 110 }]}>
                <Text style={estilos.textoHeaderCol}>RESPONSÁVEL</Text>
              </View>

              <View style={[estilos.colunaHeader, { width: 50, alignItems: 'center' }]}>
                <Text style={estilos.textoHeaderCol}>★</Text>
              </View>
            </View>

            {/* Linhas de Dados da Tabela */}
            {visiveis.length > 0 ? (
              visiveis.map((item, idx) => {
                const situacao = calcularSituacao(item);
                const cor = corPorSituacao[situacao];
                const zebra = idx % 2 === 0;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => abrir(item)}
                    style={({ pressed }) => [
                      estilos.tabelaLinha,
                      zebra ? estilos.tabelaLinhaPar : estilos.tabelaLinhaImpar,
                      pressed && estilos.tabelaLinhaPressionada,
                    ]}
                    {...(Platform.OS === 'web'
                      ? {
                          onDoubleClick: () => abrir(item),
                          title: `Clique ou duplo clique para visualizar detalhes:\n${item.competencia}`,
                        }
                      : {})}>
                    {/* Status Badge */}
                    <View style={[estilos.colunaCelula, { width: 90 }]}>
                      <View style={[estilos.badgeTabelaStatus, { backgroundColor: `${cor}20` }]}>
                        <Text style={[estilos.textoBadgeTabelaStatus, { color: cor }]} numberOfLines={1}>
                          {rotuloSituacao[situacao]}
                        </Text>
                      </View>
                    </View>

                    {/* Secretaria */}
                    <View style={[estilos.colunaCelula, { width: 85 }]}>
                      <Text style={estilos.textoSecTabela} numberOfLines={1}>
                        {item.departamentoSigla || item.departamento || '—'}
                      </Text>
                    </View>

                    {/* Setor */}
                    <View style={[estilos.colunaCelula, { width: 80 }]}>
                      <Text style={estilos.textoSetorTabela} numberOfLines={1}>
                        {item.setorSigla || item.setor || '—'}
                      </Text>
                    </View>

                    {/* Competência */}
                    <View style={[estilos.colunaCelula, { flex: 1, minWidth: 160 }]}>
                      <Text style={estilos.textoCompTabela} numberOfLines={2}>
                        {item.competencia}
                      </Text>
                    </View>

                    {/* Atende SIG */}
                    <View style={[estilos.colunaCelula, { width: 75, alignItems: 'center' }]}>
                      <Text
                        style={[
                          estilos.textoBooleanoTabela,
                          { color: item.sistemaAtende ? '#059669' : '#64748b' },
                        ]}>
                        {item.sistemaAtende ? '✓ Sim' : '✕ Não'}
                      </Text>
                    </View>

                    {/* Treinado */}
                    <View style={[estilos.colunaCelula, { width: 80, alignItems: 'center' }]}>
                      <Text
                        style={[
                          estilos.textoBooleanoTabela,
                          { color: item.houveTreinamento ? '#059669' : '#d97706' },
                        ]}>
                        {item.houveTreinamento ? '✓ Sim' : '⏳ Pend.'}
                      </Text>
                    </View>

                    {/* Responsável */}
                    <View style={[estilos.colunaCelula, { width: 110 }]}>
                      <Text style={estilos.textoRespTabela} numberOfLines={1}>
                        {item.responsavel || '—'}
                      </Text>
                      <Text style={estilos.textoCargoTabela} numberOfLines={1}>
                        {item.cargo || ''}
                      </Text>
                    </View>

                    {/* Favorito */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        aoAlternarFavorito(item);
                      }}
                      hitSlop={8}
                      style={[estilos.colunaCelula, { width: 50, alignItems: 'center' }]}>
                      <Text style={estilos.estrelaTabela}>{item.favorito ? '★' : '☆'}</Text>
                    </Pressable>
                  </Pressable>
                );
              })
            ) : (
              vazio
            )}
          </View>
        </ScrollView>
      )}

      {/* FAB de Criação */}
      <Pressable
        onPress={aoCriar}
        style={estilos.fab}
        accessibilityRole="button"
        accessibilityLabel="Adicionar nova competência (Ctrl+N)">
        <Text style={estilos.textoFab}>+</Text>
      </Pressable>
    </View>
  );
};

const criarEstilosLista = criarEstilosEscalaveis((tema, m) => ({
  container: { flex: 1, backgroundColor: tema.fundo },
  containerTabela: { flex: 1, backgroundColor: tema.fundo },
  conteudoTabela: { paddingHorizontal: 16, paddingBottom: 80 },
  cabecalho: { paddingTop: 12 },
  linhaTituloTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titulo: {
    color: tema.texto,
    fontSize: m.compacta ? 22 : 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitulo: { marginTop: 2, color: tema.textoSecundario, fontSize: 12 },

  // Alternador de Visão
  alternadorModoVisao: {
    flexDirection: 'row',
    backgroundColor: tema.superficie,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tema.borda,
    padding: 2,
  },
  botaoModoVisao: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  botaoModoVisaoAtivo: {
    backgroundColor: tema.primariaFundo,
  },
  textoModoVisao: {
    fontSize: 11,
    fontWeight: '700',
    color: tema.textoSecundario,
  },
  textoModoVisaoAtivo: {
    color: tema.primariaTexto,
  },

  rolagemFiltros: { marginHorizontal: -16 },
  faixaFiltros: { gap: 6, paddingBottom: 6, paddingHorizontal: 16 },
  chip: {
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chipAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
  textoChip: { color: tema.textoSecundario, fontSize: 11, fontWeight: '700' },
  textoChipAtivo: { color: tema.primariaTexto },

  chipPequeno: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: tema.fundoElevado,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chipPequenoAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
  textoChipPequeno: { color: tema.textoTerciario, fontSize: 10, fontWeight: '600' },
  textoChipPequenoAtivo: { color: tema.primariaTexto, fontWeight: '700' },

  conteudoLista: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  linhaGrade: { gap: m.espaco },
  itemGrade: m.colunas > 1 ? { flex: 1, maxWidth: `${100 / m.colunas}%` } : {},
  cartao: {
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: tema.fundoElevado,
  },
  areaCartao: { padding: 14 },
  cabecalhoCartao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  selo: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  textoSelo: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  grupoDireitaCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estrela: { fontSize: 18, color: tema.favorito },
  seloSetor: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: tema.superficie },
  textoSeloSetor: { color: tema.textoSecundario, fontSize: 10, fontWeight: '700' },
  competencia: { color: tema.texto, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  comoAtende: { color: tema.textoSecundario, fontSize: 11, lineHeight: 16, marginTop: 6 },
  blocoResponsavel: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: tema.borda },
  nomeResponsavel: { color: tema.texto, fontSize: 12, fontWeight: '700' },
  cargoResponsavel: { color: tema.textoSecundario, fontSize: 11, marginTop: 1 },
  faixaIndicadores: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 4 },
  indicador: { flex: 1, alignItems: 'center' },
  rotuloIndicador: { color: tema.textoTerciario, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  valorIndicador: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  linhaCamada: { color: tema.textoSecundario, fontSize: 10, marginTop: 8 },
  avisoProblema: { marginTop: 8, backgroundColor: tema.problemaFundo, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  textoAvisoProblema: { color: tema.problema, fontSize: 10, lineHeight: 14 },
  estadoVazio: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 30 },
  textoEstadoVazio: { color: tema.textoSecundario, fontSize: 13, textAlign: 'center' },

  // Estilos da Tabela no PC
  tabelaWrapper: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundoElevado,
    overflow: 'hidden',
  },
  tabelaLinhaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tema.superficie,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  colunaHeader: {
    paddingHorizontal: 4,
  },
  textoHeaderCol: {
    fontSize: 9,
    fontWeight: '800',
    color: tema.textoTerciario,
    letterSpacing: 0.5,
  },
  tabelaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
    cursor: (Platform.OS === 'web' ? 'pointer' : undefined) as any,
  },
  tabelaLinhaPar: { backgroundColor: tema.fundoElevado },
  tabelaLinhaImpar: { backgroundColor: tema.superficie },
  tabelaLinhaPressionada: { backgroundColor: tema.primariaFundo },
  colunaCelula: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  badgeTabelaStatus: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
  },
  textoBadgeTabelaStatus: { fontSize: 9, fontWeight: '800' },
  textoSecTabela: { fontSize: 11, fontWeight: '800', color: tema.primaria },
  textoSetorTabela: { fontSize: 11, fontWeight: '700', color: tema.texto },
  textoCompTabela: { fontSize: 11, color: tema.texto, lineHeight: 15 },
  textoBooleanoTabela: { fontSize: 11, fontWeight: '700' },
  textoRespTabela: { fontSize: 11, fontWeight: '600', color: tema.texto },
  textoCargoTabela: { fontSize: 9, color: tema.textoTerciario },
  estrelaTabela: { fontSize: 16, color: tema.favorito },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tema.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: tema.sombra,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  textoFab: { color: tema.textoInvertido, fontSize: 24, fontWeight: '600', lineHeight: 26 },
}));

export default ListaRegistros;
