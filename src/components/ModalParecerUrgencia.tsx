import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calcularUrgencia,
  rotuloColunaKanban,
  obterColunaKanban,
} from '../data/kanban';
import type { DecisaoParecerUrgencia, Registro } from '../data/registros';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';

export type DadosParecerUrgencia = {
  decisao: DecisaoParecerUrgencia;
  parecer: string;
  responsavelContinuidade?: string;
  numeroSei?: string;
};

type Props = {
  registro: Registro | null;
  visivel: boolean;
  aoFechar: () => void;
  aoConfirmar: (registroId: string, dados: DadosParecerUrgencia) => void;
};

const OPCOES_DECISAO: {
  id: DecisaoParecerUrgencia;
  titulo: string;
  descricao: string;
}[] = [
  {
    id: 'concluido',
    titulo: 'Dar como Concluído',
    descricao: 'Encerra a pendência urgente e move o card para Concluído.',
  },
  {
    id: 'revisao',
    titulo: 'Enviar para Revisão',
    descricao: 'Move para Revisão e define quem pode dar continuidade.',
  },
  {
    id: 'em_processo',
    titulo: 'Encaminhar para Em processo',
    descricao: 'Retira da fila de Urgência e devolve ao fluxo operacional.',
  },
];

const ModalParecerUrgencia: React.FC<Props> = ({
  registro,
  visivel,
  aoFechar,
  aoConfirmar,
}) => {
  const tema = useTema();
  const metricas = useMetricas();

  const [decisao, setDecisao] = useState<DecisaoParecerUrgencia>('revisao');
  const [responsavelContinuidade, setResponsavelContinuidade] = useState('');
  const [numeroSei, setNumeroSei] = useState('');
  const [parecer, setParecer] = useState('');

  const registroId = registro?.id ?? null;

  useEffect(() => {
    if (visivel && registro) {
      setDecisao('revisao');
      setResponsavelContinuidade(registro.kanban?.responsavelContinuidade ?? '');
      setNumeroSei(registro.numeroSei ?? '');
      setParecer('');
    }
    // Re-inicializa apenas quando o modal abre ou troca de registro, evitando
    // apagar o parecer em digitação caso `registro` receba nova referência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, registroId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visivel) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [visivel, aoFechar]);

  if (!visivel || !registro) {
    return null;
  }

  const urgencia = calcularUrgencia(registro);
  const colunaAtual = obterColunaKanban(registro);
  const estilos = criarEstilos(tema, metricas.expandida);

  const confirmar = () => {
    const texto = parecer.trim();
    if (!texto) {
      Alert.alert(
        'Parecer obrigatório',
        'Informe o texto do parecer técnico para registrar o encaminhamento.',
      );
      return;
    }

    aoConfirmar(registro.id, {
      decisao,
      parecer: texto,
      responsavelContinuidade: responsavelContinuidade.trim(),
      numeroSei: numeroSei.trim() || undefined,
    });
    aoFechar();
  };

  return (
    <Modal
      visible
      transparent
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
      onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={aoFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar parecer de urgência"
        />

        <View style={estilos.janela}>
          <View style={estilos.cabecalho}>
            <View style={estilos.titulos}>
              <Text style={estilos.tagSuperior}>PARECER DE URGÊNCIA · FLUXO KANBAN</Text>
              <Text style={estilos.titulo}>Encaminhamento e Decisão</Text>
            </View>
            <Pressable
              onPress={aoFechar}
              style={estilos.botaoFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Text style={estilos.textoBotaoFechar}>Fechar</Text>
            </Pressable>
          </View>

          <ScrollView
            style={estilos.scroll}
            contentContainerStyle={estilos.conteudo}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator>
            {/* Resumo do Card */}
            <View style={estilos.blocoResumo}>
              <View style={estilos.linhaMetaResumo}>
                <Text style={estilos.metaUnidade}>
                  {registro.departamentoSigla || registro.departamento || 'PREFEITURA'} ·{' '}
                  {registro.setorSigla || registro.setor || 'SETOR'}
                </Text>
                <View style={estilos.badgeColunaAtual}>
                  <Text style={estilos.textoBadgeColunaAtual}>
                    Atual: {rotuloColunaKanban[colunaAtual]}
                  </Text>
                </View>
              </View>
              <Text style={estilos.textoCompetencia} numberOfLines={3}>
                {registro.competencia}
              </Text>
              <Text style={estilos.textoResponsavel}>
                Responsável do setor: {registro.responsavel || 'Não informado'}
              </Text>
            </View>

            {/* Diagnóstico da Pontuação de Urgência */}
            <View style={estilos.blocoUrgencia}>
              <View style={estilos.linhaTopoUrgencia}>
                <Text style={estilos.tituloUrgencia}>Cálculo de Urgência</Text>
                <View style={estilos.badgePontos}>
                  <Text style={estilos.textoBadgePontos}>
                    Índice: {urgencia.pontuacao} pts
                  </Text>
                </View>
              </View>
              {urgencia.fatores.length > 0 ? (
                <View style={estilos.listaFatores}>
                  {urgencia.fatores.map((f) => (
                    <View key={f.codigo} style={estilos.chipFator}>
                      <Text style={estilos.textoChipFator}>
                        {f.rotulo} (+{f.peso})
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={estilos.textoSemFatores}>
                  Nenhum fator negativo calculado automaticamente.
                </Text>
              )}
            </View>

            {/* Seleção da Decisão */}
            <Text style={estilos.rotuloSecao}>1. Decisão do Parecer *</Text>
            <View style={estilos.listaDecisoes}>
              {OPCOES_DECISAO.map((op) => {
                const selecionada = decisao === op.id;
                return (
                  <Pressable
                    key={op.id}
                    onPress={() => setDecisao(op.id)}
                    style={[
                      estilos.cartaoDecisao,
                      selecionada && estilos.cartaoDecisaoAtiva,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selecionada }}>
                    <View style={estilos.linhaTituloDecisao}>
                      <View
                        style={[
                          estilos.indicadorRadio,
                          selecionada && estilos.indicadorRadioAtivo,
                        ]}
                      />
                      <Text
                        style={[
                          estilos.tituloDecisao,
                          selecionada && estilos.tituloDecisaoAtiva,
                        ]}>
                        {op.titulo}
                      </Text>
                    </View>
                    <Text style={estilos.descricaoDecisao}>{op.descricao}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Responsável pela Continuidade */}
            <Text style={estilos.rotuloSecao}>
              2. A quem encaminhar / Responsável pela continuidade (opcional)
            </Text>
            <TextInput
              value={responsavelContinuidade}
              onChangeText={setResponsavelContinuidade}
              placeholder="Ex.: DASI / Gerência DICI / Servidor responsável pela continuidade"
              placeholderTextColor={tema.textoTerciario}
              style={estilos.input}
            />

            {/* Número do SEI (opcional) */}
            <Text style={estilos.rotuloSecao}>3. Número do SEI (opcional)</Text>
            <TextInput
              value={numeroSei}
              onChangeText={setNumeroSei}
              placeholder="Ex.: 00600-00012345/2026-01"
              placeholderTextColor={tema.textoTerciario}
              style={estilos.input}
            />

            {/* Texto do Parecer */}
            <Text style={estilos.rotuloSecao}>4. Parecer / Justificativa *</Text>
            <TextInput
              value={parecer}
              onChangeText={setParecer}
              placeholder="Descreva o parecer técnico, motivo da conclusão ou orientação para revisão e continuidade..."
              placeholderTextColor={tema.textoTerciario}
              multiline
              style={[estilos.input, estilos.inputMultilinha]}
            />
          </ScrollView>

          <View style={estilos.rodape}>
            <Pressable onPress={aoFechar} style={estilos.botaoCancelar}>
              <Text style={estilos.textoBotaoCancelar}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={confirmar}
              disabled={!parecer.trim()}
              style={[
                estilos.botaoConfirmar,
                !parecer.trim() && estilos.botaoDesabilitado,
              ]}>
              <Text style={estilos.textoBotaoConfirmar}>Registrar Parecer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const criarEstilos = (tema: Tema, ePC: boolean) =>
  StyleSheet.create({
    fundo: {
      flex: 1,
      justifyContent: ePC ? 'center' : 'flex-end',
      alignItems: ePC ? 'center' : 'stretch',
      backgroundColor: tema.overlay,
      padding: ePC ? 20 : 0,
    },
    janela: {
      width: ePC ? '92%' : '100%',
      maxWidth: ePC ? 640 : undefined,
      maxHeight: ePC ? '90%' : '92%',
      backgroundColor: tema.fundoElevado,
      borderRadius: ePC ? 18 : 20,
      borderWidth: 1,
      borderColor: tema.borda,
      overflow: 'hidden',
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: tema.borda,
    },
    titulos: { flex: 1, paddingRight: 12 },
    tagSuperior: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: tema.erro,
      textTransform: 'uppercase',
    },
    titulo: {
      fontSize: 17,
      fontWeight: '800',
      color: tema.texto,
      marginTop: 2,
    },
    botaoFechar: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tema.borda,
      backgroundColor: tema.superficie,
    },
    textoBotaoFechar: {
      fontSize: 12,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    scroll: { maxHeight: 540 },
    conteudo: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      gap: 10,
    },
    blocoResumo: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    linhaMetaResumo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    metaUnidade: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.primariaTexto,
      flexShrink: 1,
    },
    badgeColunaAtual: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBadgeColunaAtual: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    textoCompetencia: {
      fontSize: 13,
      fontWeight: '600',
      color: tema.texto,
      lineHeight: 18,
    },
    textoResponsavel: {
      fontSize: 11,
      color: tema.textoSecundario,
    },
    blocoUrgencia: {
      backgroundColor: tema.erroFundo,
      borderWidth: 1,
      borderColor: tema.erro,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    linhaTopoUrgencia: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tituloUrgencia: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: tema.erro,
    },
    badgePontos: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.erro,
    },
    textoBadgePontos: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.erro,
    },
    listaFatores: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chipFator: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoChipFator: {
      fontSize: 11,
      fontWeight: '600',
      color: tema.texto,
    },
    textoSemFatores: {
      fontSize: 12,
      color: tema.textoSecundario,
    },
    rotuloSecao: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: tema.textoSecundario,
      marginTop: 6,
    },
    listaDecisoes: {
      gap: 8,
    },
    cartaoDecisao: {
      padding: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tema.borda,
      backgroundColor: tema.superficie,
      gap: 4,
    },
    cartaoDecisaoAtiva: {
      borderColor: tema.primaria,
      backgroundColor: tema.primariaFundo,
    },
    linhaTituloDecisao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    indicadorRadio: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: tema.textoTerciario,
    },
    indicadorRadioAtivo: {
      borderColor: tema.primaria,
      backgroundColor: tema.primaria,
    },
    tituloDecisao: {
      fontSize: 13,
      fontWeight: '700',
      color: tema.texto,
    },
    tituloDecisaoAtiva: {
      color: tema.primariaTexto,
    },
    descricaoDecisao: {
      fontSize: 11,
      color: tema.textoSecundario,
      paddingLeft: 22,
    },
    input: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: tema.texto,
      fontSize: 13,
    },
    inputMultilinha: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    rodape: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    botaoCancelar: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoCancelar: {
      fontSize: 13,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    botaoConfirmar: {
      flex: 1.5,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: tema.primaria,
    },
    botaoDesabilitado: {
      opacity: 0.45,
    },
    textoBotaoConfirmar: {
      fontSize: 13,
      fontWeight: '700',
      color: tema.textoInvertido,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

export default ModalParecerUrgencia;
