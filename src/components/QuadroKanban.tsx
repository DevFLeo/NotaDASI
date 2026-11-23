import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COLUNAS_KANBAN,
  calcularUrgencia,
  obterColunaKanban,
  rotuloColunaKanban,
  type AvaliacaoUrgencia,
} from '../data/kanban';
import type { ColunaKanban, Registro } from '../data/registros';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import ModalParecerUrgencia, { type DadosParecerUrgencia } from './ModalParecerUrgencia';

type Props = {
  registros: Registro[];
  aoSelecionar: (registro: Registro) => void;
  aoMoverColuna?: (
    id: string,
    coluna: ColunaKanban | undefined,
    responsavelContinuidade?: string,
  ) => void;
  aoRegistrarParecerUrgencia?: (id: string, dados: DadosParecerUrgencia) => void;
};

type ItemKanban = {
  registro: Registro;
  coluna: ColunaKanban;
  urgencia: AvaliacaoUrgencia;
};

const resumir = (texto: string, limite: number): string =>
  texto.length <= limite ? texto : `${texto.slice(0, limite).trimEnd()}...`;

const corDaColuna = (coluna: ColunaKanban, tema: Tema): { principal: string; fundo: string } => {
  switch (coluna) {
    case 'nao_iniciado':
      return { principal: tema.textoSecundario, fundo: tema.superficie };
    case 'em_processo':
      return { principal: tema.primaria, fundo: tema.primariaFundo };
    case 'urgencia':
      return { principal: tema.erro, fundo: tema.erroFundo };
    case 'revisao':
      return { principal: tema.alerta, fundo: tema.alertaFundo };
    case 'concluido':
      return { principal: tema.sucesso, fundo: tema.sucessoFundo };
  }
};

const QuadroKanban: React.FC<Props> = ({
  registros,
  aoSelecionar,
  aoMoverColuna,
  aoRegistrarParecerUrgencia,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useMemo(() => criarEstilos(tema), [tema]);

  const [colunaFocada, setColunaFocada] = useState<ColunaKanban | 'todas'>('todas');
  const [registroParaParecer, setRegistroParaParecer] = useState<Registro | null>(null);

  const grupos = useMemo(() => {
    const mapa: Record<ColunaKanban, ItemKanban[]> = {
      nao_iniciado: [],
      em_processo: [],
      urgencia: [],
      revisao: [],
      concluido: [],
    };

    for (const registro of registros) {
      const coluna = obterColunaKanban(registro);
      const urgencia = calcularUrgencia(registro);
      mapa[coluna].push({ registro, coluna, urgencia });
    }

    // Na aba de Urgência, ordena da maior pontuação para a menor
    mapa.urgencia.sort((a, b) => b.urgencia.pontuacao - a.urgencia.pontuacao);

    return mapa;
  }, [registros]);

  const colunasVisiveis = useMemo(
    () =>
      colunaFocada === 'todas'
        ? COLUNAS_KANBAN
        : COLUNAS_KANBAN.filter((c) => c.id === colunaFocada),
    [colunaFocada],
  );

  // No celular, ajusta a largura da coluna para caber na tela deixando uma "espiada" da próxima
  const larguraColuna = metricas.compacta
    ? Math.min(Math.max(Math.round(metricas.largura - 56), 256), 312)
    : 296;
  const estiloLarguraColuna = useMemo(
    () => (colunaFocada === 'todas' ? { width: larguraColuna } : estilos.colunaCheia),
    [colunaFocada, larguraColuna, estilos.colunaCheia],
  );

  const confirmarParecer = (registroId: string, dados: DadosParecerUrgencia) => {
    aoRegistrarParecerUrgencia?.(registroId, dados);
    setRegistroParaParecer(null);
  };

  const renderizarColunas = () =>
    colunasVisiveis.map((col) => {
      const itens = grupos[col.id];
      const cores = corDaColuna(col.id, tema);

      return (
        <View key={col.id} style={[estilos.coluna, estiloLarguraColuna]}>
          {/* Cabeçalho da Coluna */}
          <View
            style={[
              estilos.cabecalhoColuna,
              { borderTopColor: cores.principal },
            ]}>
            <View style={estilos.linhaTituloColuna}>
              <Text style={[estilos.tituloColuna, { color: cores.principal }]}>
                {col.titulo}
              </Text>
              <View
                style={[
                  estilos.contadorColuna,
                  { backgroundColor: cores.fundo, borderColor: cores.principal },
                ]}>
                <Text style={[estilos.textoContadorColuna, { color: cores.principal }]}>
                  {itens.length}
                </Text>
              </View>
            </View>
            <Text style={estilos.descricaoColuna}>{col.descricao}</Text>
          </View>

          {/* Cards da Coluna */}
          <View style={estilos.listaCards}>
            {itens.length === 0 ? (
              <View style={estilos.colunaVazia}>
                <Text style={estilos.textoColunaVazia}>
                  Nenhuma competência nesta etapa.
                </Text>
              </View>
            ) : (
              itens.map(({ registro, urgencia }) => {
                const ultimoParecer =
                  registro.kanban?.pareceresUrgencia?.[
                    registro.kanban.pareceresUrgencia.length - 1
                  ];
                const temOverrideManual = Boolean(registro.kanban?.colunaManual);

                return (
                  <Pressable
                    key={registro.id}
                    onPress={() => aoSelecionar(registro)}
                    {...(Platform.OS === 'web'
                      ? { onDoubleClick: () => aoSelecionar(registro) }
                      : {})}
                    style={({ pressed }) => [
                      estilos.card,
                      col.id === 'urgencia' && { borderColor: `${tema.erro}66` },
                      pressed && estilos.cardPressionado,
                    ]}>
                    {/* Topo do Card: Unidade + Índice de Urgência / SEI */}
                    <View style={estilos.topoCard}>
                      <Text style={estilos.tagUnidade} numberOfLines={1}>
                        {registro.departamentoSigla || registro.departamento || 'PREFEITURA'} ·{' '}
                        {registro.setorSigla || registro.setor || 'SETOR'}
                      </Text>

                      {col.id === 'urgencia' ? (
                        <View style={estilos.badgeUrgencia}>
                          <Text style={estilos.textoBadgeUrgencia}>
                            Índice {urgencia.pontuacao}
                          </Text>
                        </View>
                      ) : temOverrideManual ? (
                        <View style={estilos.badgeManual}>
                          <Text style={estilos.textoBadgeManual}>Definido</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Competência */}
                    <Text style={estilos.textoCompetencia} numberOfLines={3}>
                      {resumir(registro.competencia, 125)}
                    </Text>

                    {/* Responsável */}
                    <Text style={estilos.textoResponsavel} numberOfLines={1}>
                      Responsável: {registro.responsavel || 'Não informado'}
                    </Text>

                    {/* Número do SEI (quando preenchido) */}
                    {registro.numeroSei ? (
                      <View style={estilos.badgeSei}>
                        <Text style={estilos.textoBadgeSei} numberOfLines={1}>
                          SEI: {registro.numeroSei}
                        </Text>
                      </View>
                    ) : null}

                    {/* Fatores calculados na aba de Urgência */}
                    {col.id === 'urgencia' && urgencia.fatores.length > 0 ? (
                      <View style={estilos.blocoFatores}>
                        {urgencia.fatores.slice(0, 4).map((f) => (
                          <View key={f.codigo} style={estilos.tagFator}>
                            <Text style={estilos.textoTagFator}>{f.rotulo}</Text>
                          </View>
                        ))}
                        {urgencia.fatores.length > 4 ? (
                          <Text style={estilos.textoMaisFatores}>
                            +{urgencia.fatores.length - 4} pendências
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Informações de Revisão / Continuidade / Último Parecer */}
                    {(col.id === 'revisao' || col.id === 'concluido') &&
                    (registro.kanban?.responsavelContinuidade || ultimoParecer) ? (
                      <View style={estilos.blocoParecerResumo}>
                        {registro.kanban?.responsavelContinuidade ? (
                          <Text style={estilos.textoContinuidade} numberOfLines={1}>
                            Continuidade: {registro.kanban.responsavelContinuidade}
                          </Text>
                        ) : null}
                        {ultimoParecer ? (
                          <Text style={estilos.textoUltimoParecer} numberOfLines={2}>
                            Parecer ({ultimoParecer.nome}): {ultimoParecer.parecer}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Rodapé de Ações do Card */}
                    <View style={estilos.rodapeCard}>
                      {col.id === 'urgencia' && aoRegistrarParecerUrgencia ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setRegistroParaParecer(registro);
                          }}
                          style={estilos.botaoParecerUrgencia}>
                          <Text style={estilos.textoBotaoParecerUrgencia}>
                            Emitir Parecer
                          </Text>
                        </Pressable>
                      ) : null}

                      {col.id === 'nao_iniciado' && aoMoverColuna ? (
                        <>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              aoMoverColuna(registro.id, 'em_processo');
                            }}
                            style={estilos.botaoAcaoSecundaria}>
                            <Text style={estilos.textoBotaoAcaoSecundaria}>Em processo</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              aoMoverColuna(registro.id, 'revisao');
                            }}
                            style={estilos.botaoAcaoSecundaria}>
                            <Text style={estilos.textoBotaoAcaoSecundaria}>Revisão</Text>
                          </Pressable>
                        </>
                      ) : null}

                      {col.id === 'em_processo' && aoMoverColuna ? (
                        <>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              aoMoverColuna(registro.id, 'revisao');
                            }}
                            style={estilos.botaoAcaoSecundaria}>
                            <Text style={estilos.textoBotaoAcaoSecundaria}>Revisão</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              aoMoverColuna(registro.id, 'concluido');
                            }}
                            style={estilos.botaoAcaoPrimaria}>
                            <Text style={estilos.textoBotaoAcaoPrimaria}>Concluir</Text>
                          </Pressable>
                        </>
                      ) : null}

                      {col.id === 'revisao' ? (
                        <>
                          {aoRegistrarParecerUrgencia ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setRegistroParaParecer(registro);
                              }}
                              style={estilos.botaoAcaoSecundaria}>
                              <Text style={estilos.textoBotaoAcaoSecundaria}>Parecer</Text>
                            </Pressable>
                          ) : null}
                          {aoMoverColuna ? (
                            <>
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  aoMoverColuna(registro.id, 'em_processo');
                                }}
                                style={estilos.botaoAcaoSecundaria}>
                                <Text style={estilos.textoBotaoAcaoSecundaria}>
                                  Em processo
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  aoMoverColuna(registro.id, 'concluido');
                                }}
                                style={estilos.botaoAcaoPrimaria}>
                                <Text style={estilos.textoBotaoAcaoPrimaria}>Concluir</Text>
                              </Pressable>
                            </>
                          ) : null}
                        </>
                      ) : null}

                      {col.id === 'concluido' && aoMoverColuna ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            aoMoverColuna(registro.id, 'revisao');
                          }}
                          style={estilos.botaoAcaoSecundaria}>
                          <Text style={estilos.textoBotaoAcaoSecundaria}>
                            Enviar para Revisão
                          </Text>
                        </Pressable>
                      ) : null}

                      {temOverrideManual && aoMoverColuna ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            aoMoverColuna(registro.id, undefined);
                          }}
                          style={estilos.botaoResetAutomatico}
                          accessibilityLabel={`Restaurar cálculo automático para ${rotuloColunaKanban[col.id]}`}>
                          <Text style={estilos.textoBotaoResetAutomatico}>Auto</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      );
    });

  return (
    <View style={estilos.container}>
      {/* Barra de Resumo e Foco por Coluna */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.barraResumoScroll}
        contentContainerStyle={estilos.barraResumo}>
        <Pressable
          onPress={() => setColunaFocada('todas')}
          style={[estilos.pillColuna, colunaFocada === 'todas' && estilos.pillColunaAtiva]}>
          <Text
            style={[
              estilos.textoPillColuna,
              colunaFocada === 'todas' && estilos.textoPillColunaAtiva,
            ]}>
            Todas ({registros.length})
          </Text>
        </Pressable>

        {COLUNAS_KANBAN.map((col) => {
          const total = grupos[col.id].length;
          const ativo = colunaFocada === col.id;
          const cores = corDaColuna(col.id, tema);
          return (
            <Pressable
              key={col.id}
              onPress={() => setColunaFocada(ativo ? 'todas' : col.id)}
              style={[
                estilos.pillColuna,
                ativo && {
                  backgroundColor: cores.fundo,
                  borderColor: cores.principal,
                },
              ]}>
              <View style={[estilos.pontoColuna, { backgroundColor: cores.principal }]} />
              <Text
                style={[
                  estilos.textoPillColuna,
                  ativo && { color: cores.principal },
                ]}>
                {col.titulo} ({total})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Quadro Horizontal de Colunas Kanban (ou coluna única sem ScrollView vertical aninhado) */}
      {colunaFocada === 'todas' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          decelerationRate={metricas.compacta ? 'fast' : 'normal'}
          snapToInterval={metricas.compacta ? larguraColuna + 12 : undefined}
          snapToAlignment="start"
          contentContainerStyle={estilos.quadroConteudo}>
          {renderizarColunas()}
        </ScrollView>
      ) : (
        <View style={[estilos.quadroConteudo, estilos.quadroColunaUnica]}>
          {renderizarColunas()}
        </View>
      )}

      {/* Modal de Parecer da Aba de Urgência / Revisão */}
      <ModalParecerUrgencia
        registro={registroParaParecer}
        visivel={registroParaParecer !== null}
        aoFechar={() => setRegistroParaParecer(null)}
        aoConfirmar={confirmarParecer}
      />
    </View>
  );
};

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    container: {
      flex: 1,
      marginTop: 6,
    },
    barraResumoScroll: {
      flexGrow: 0,
      marginBottom: 10,
    },
    barraResumo: {
      gap: 6,
      paddingVertical: 2,
    },
    pillColuna: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    pillColunaAtiva: {
      backgroundColor: tema.primariaFundo,
      borderColor: tema.primaria,
    },
    pontoColuna: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    textoPillColuna: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    textoPillColunaAtiva: {
      color: tema.primariaTexto,
    },
    quadroConteudo: {
      gap: 12,
      paddingBottom: 24,
      alignItems: 'flex-start',
    },
    quadroColunaUnica: {
      width: '100%',
    },
    coluna: {
      backgroundColor: tema.superficie,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tema.borda,
      overflow: 'hidden',
    },
    colunaCheia: {
      width: '100%',
    },
    cabecalhoColuna: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 3,
      borderBottomWidth: 1,
      borderBottomColor: tema.borda,
      backgroundColor: tema.fundoElevado,
      gap: 4,
    },
    linhaTituloColuna: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    tituloColuna: {
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    contadorColuna: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
    },
    textoContadorColuna: {
      fontSize: 11,
      fontWeight: '800',
    },
    descricaoColuna: {
      fontSize: 11,
      color: tema.textoSecundario,
      lineHeight: 15,
    },
    listaCards: {
      padding: 10,
      gap: 10,
    },
    colunaVazia: {
      paddingVertical: 20,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    textoColunaVazia: {
      fontSize: 11,
      color: tema.textoTerciario,
      textAlign: 'center',
    },
    card: {
      backgroundColor: tema.fundoElevado,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 11,
      gap: 6,
    },
    cardPressionado: {
      opacity: 0.85,
    },
    topoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    tagUnidade: {
      fontSize: 10,
      fontWeight: '800',
      color: tema.primariaTexto,
      flexShrink: 1,
    },
    badgeUrgencia: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tema.erroFundo,
      borderWidth: 1,
      borderColor: tema.erro,
    },
    textoBadgeUrgencia: {
      fontSize: 10,
      fontWeight: '800',
      color: tema.erro,
    },
    badgeManual: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBadgeManual: {
      fontSize: 9,
      fontWeight: '700',
      color: tema.textoSecundario,
      textTransform: 'uppercase',
    },
    textoCompetencia: {
      fontSize: 12,
      fontWeight: '600',
      color: tema.texto,
      lineHeight: 17,
    },
    textoResponsavel: {
      fontSize: 11,
      color: tema.textoSecundario,
    },
    badgeSei: {
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tema.primariaFundo,
      borderWidth: 1,
      borderColor: tema.primaria,
    },
    textoBadgeSei: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.primariaTexto,
    },
    blocoFatores: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 2,
    },
    tagFator: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: tema.erroFundo,
    },
    textoTagFator: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.erro,
    },
    textoMaisFatores: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoSecundario,
      alignSelf: 'center',
    },
    blocoParecerResumo: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      gap: 3,
    },
    textoContinuidade: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.alerta,
    },
    textoUltimoParecer: {
      fontSize: 11,
      color: tema.textoSecundario,
      lineHeight: 15,
    },
    rodapeCard: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
    },
    botaoParecerUrgencia: {
      flexGrow: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 7,
      backgroundColor: tema.erro,
      alignItems: 'center',
    },
    textoBotaoParecerUrgencia: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.textoInvertido,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    botaoAcaoPrimaria: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: tema.sucessoFundo,
      borderWidth: 1,
      borderColor: tema.sucesso,
    },
    textoBotaoAcaoPrimaria: {
      fontSize: 10,
      fontWeight: '800',
      color: tema.sucesso,
    },
    botaoAcaoSecundaria: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoAcaoSecundaria: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    botaoResetAutomatico: {
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: tema.fundo,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoResetAutomatico: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoTerciario,
    },
  });

export default QuadroKanban;
