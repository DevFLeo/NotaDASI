import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '../auth/useSessao';
import ContatoProtegido from './ContatoProtegido';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  type Registro,
} from '../data/registros';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';

type Props = {
  registro: Registro | null;
  aoFechar: () => void;
  aoEditar?: (registro: Registro) => void;
  aoExcluir?: (registro: Registro) => void;
  aoAlternarFavorito?: (registro: Registro) => void;
  aoAdicionarComentario?: (id: string, texto: string) => void;
  aoSalvarNotaPessoal?: (id: string, texto: string) => void;
};

const simNao = (valor?: boolean): string =>
  valor === true ? 'Sim' : valor === false ? 'Não' : '—';

const DetalheRegistro: React.FC<Props> = ({
  registro,
  aoFechar,
  aoEditar,
  aoExcluir,
  aoAlternarFavorito,
  aoAdicionarComentario,
  aoSalvarNotaPessoal,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const insets = useSafeAreaInsets();
  const { contaAtual } = useSessao();
  const { gesto, estiloArrasto, telaCheia, alternarTelaCheia } = useArrastarParaFechar(aoFechar);

  const [novoComentario, setNovoComentario] = useState('');
  const [notaPessoal, setNotaPessoal] = useState(() =>
    registro && contaAtual ? registro.notasPessoais?.[contaAtual.usuario] ?? '' : '',
  );

  if (!registro) {
    return null;
  }

  const situacao = calcularSituacao(registro);
  const cor = corPorSituacao[situacao];

  const eChefeDgeo = contaAtual?.papel === 'gerente';
  const eSecretaria = contaAtual?.papel === 'secretario';
  const eDasi = contaAtual?.papel === 'dasi' || (!eChefeDgeo && !eSecretaria);

  const estilos = criarEstilosDetalhe(tema, metricas, telaCheia);

  const enviarComentario = () => {
    if (!novoComentario.trim() || !aoAdicionarComentario) return;
    aoAdicionarComentario(registro.id, novoComentario.trim());
    setNovoComentario('');
  };

  const salvarMinhaNota = () => {
    if (aoSalvarNotaPessoal) {
      aoSalvarNotaPessoal(registro.id, notaPessoal);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={aoFechar}>
      <GestureHandlerRootView style={estilos.fundo}>
        <Animated.View style={[estilos.wrapperAnimado, estiloArrasto]}>
          <View style={estilos.painel}>
            {/* Puxador com gesto para expandir em tela cheia (arraste para cima) */}
            <GestureDetector gesture={gesto}>
              <View style={estilos.areaPuxador}>
                <View style={estilos.puxador} />
                {!metricas.expandida ? (
                  <Text style={estilos.dicaArrasto}>
                    {telaCheia ? 'Arraste para baixo para reduzir' : 'Arraste para cima para tela cheia'}
                  </Text>
                ) : null}
              </View>
            </GestureDetector>

            {/* Cabeçalho */}
            <View style={estilos.cabecalho}>
              <View style={[estilos.selo, { backgroundColor: `${cor}22` }]}>
                <Text
                  style={[estilos.textoSelo, { color: cor }]}
                  maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                  {rotuloSituacao[situacao]}
                </Text>
              </View>

              <View style={estilos.acoesTopo}>
                {aoAlternarFavorito ? (
                  <Pressable
                    onPress={() => aoAlternarFavorito(registro)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      registro.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
                    }
                    hitSlop={12}>
                    <Text style={estilos.estrela}>{registro.favorito ? '★' : '☆'}</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={alternarTelaCheia}
                  accessibilityRole="button"
                  accessibilityLabel={telaCheia ? 'Restaurar tamanho' : 'Tela cheia'}
                  style={estilos.botaoIcone}>
                  <Text style={estilos.textoBotaoIcone}>{telaCheia ? '🗕' : '⤢'}</Text>
                </Pressable>

                <Pressable
                  onPress={aoFechar}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar modal"
                  style={estilos.botaoIcone}>
                  <Text style={estilos.textoBotaoIcone}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Conteúdo com rolagem suave no mouse wheel */}
            <ScrollView
              style={estilos.scroll}
              contentContainerStyle={estilos.conteudo}
              showsVerticalScrollIndicator>
              <Text style={estilos.titulo}>{registro.competencia}</Text>

              {/* Informações da Lotação e SIG */}
              <View style={estilos.grade}>
                <Secao tema={tema} titulo="Lotação" />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Departamento"
                  valor={rotularUnidade(registro.departamentoSigla, registro.departamento)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Direção"
                  valor={
                    [registro.departamentoCargo, registro.departamentoResponsavel]
                      .filter(Boolean)
                      .join(' ') || '—'
                  }
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Setor / Divisão"
                  valor={rotularUnidade(registro.setorSigla, registro.setor)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Responsável"
                  valor={[registro.cargo, registro.responsavel].filter(Boolean).join(' ') || '—'}
                />

                <Secao tema={tema} titulo="Atendimento pelo SIG" />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="O sistema atende?"
                  valor={simNao(registro.sistemaAtende)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Já estruturado no sistema?"
                  valor={simNao(registro.estruturadoNoSistema)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Houve treinamento?"
                  valor={simNao(registro.houveTreinamento)}
                />
                {registro.comoAtende ? (
                  <Campo tema={tema} rotulo="De que forma atende" valor={registro.comoAtende} largo />
                ) : null}

                <Secao tema={tema} titulo="Camadas & Módulo" />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Informações acessadas"
                  valor={registro.informacoesAcessadas || '—'}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Nível de acesso à camada"
                  valor={registro.nivelAcessoCamada || '—'}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Acesso à camada concedido?"
                  valor={simNao(registro.acessoCamadaConcedido)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Iniciou a atividade?"
                  valor={simNao(registro.iniciouAtividade)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Módulo do SIG"
                  valor={registro.moduloSig || '—'}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Nível de acesso ao módulo"
                  valor={registro.nivelAcessoModulo || '—'}
                />

                <Secao tema={tema} titulo="Problemas & Chamados" />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Tem problema no SIG?"
                  valor={simNao(registro.temProblema)}
                />
                <Campo
                  tema={tema}
                  colunaDupla={metricas.expandida}
                  rotulo="Tem chamado aberto?"
                  valor={simNao(registro.temChamado)}
                />
                {registro.detalheProblema ? (
                  <Campo tema={tema} rotulo="Detalhe do problema" valor={registro.detalheProblema} largo />
                ) : null}
                {registro.observacao ? (
                  <Campo tema={tema} rotulo="Observação" valor={registro.observacao} largo />
                ) : null}

                {/* Contatos */}
                {registro.contatoInstitucional?.email || registro.contatoInstitucional?.telefone ? (
                  <>
                    <Secao tema={tema} titulo="Contato institucional" />
                    <View style={estilos.blocoLargo}>
                      {registro.contatoInstitucional.email ? (
                        <Text style={estilos.valor} selectable>
                          📧 {registro.contatoInstitucional.email}
                        </Text>
                      ) : null}
                      {registro.contatoInstitucional.telefone ? (
                        <Text style={estilos.valor} selectable>
                          📞 {registro.contatoInstitucional.telefone}
                        </Text>
                      ) : null}
                      {registro.contatoInstitucional.ramal ? (
                        <Text style={estilos.valor} selectable>
                          Ramal: {registro.contatoInstitucional.ramal}
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : null}

                <View style={estilos.blocoLargo}>
                  <ContatoProtegido contato={registro.contatoPessoal} />
                </View>
              </View>

              {/* Feed de Comentários / Pareceres (DASI, Chefe DGEO, Secretaria) */}
              <View style={estilos.blocoAuditavel}>
                <Secao tema={tema} titulo="💬 Pareceres & Comentários Oficiais" />
                {registro.comentarios && registro.comentarios.length > 0 ? (
                  <View style={estilos.listaComentarios}>
                    {registro.comentarios.map((c) => (
                      <View key={c.id} style={estilos.cartaoComentario}>
                        <View style={estilos.cabecalhoComentario}>
                          <Text style={estilos.autorComentario}>
                            [{c.papel.toUpperCase()}] {c.nome || c.usuario}
                          </Text>
                          <Text style={estilos.dataComentario}>
                            {new Date(c.dataHora).toLocaleString('pt-BR')}
                          </Text>
                        </View>
                        <Text style={estilos.textoComentario}>{c.texto}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={estilos.textoVazio}>Nenhum comentário registrado ainda.</Text>
                )}

                {/* Campo para novo comentário */}
                <View style={estilos.areaNovoComentario}>
                  <TextInput
                    value={novoComentario}
                    onChangeText={setNovoComentario}
                    placeholder="Declarar comentário ou parecer técnico..."
                    placeholderTextColor={tema.textoTerciario}
                    multiline
                    style={estilos.inputComentario}
                  />
                  <Pressable onPress={enviarComentario} style={estilos.botaoEnviarComentario}>
                    <Text style={estilos.textoBotaoEnviar}>Comentar</Text>
                  </Pressable>
                </View>
              </View>

              {/* Anotação para uso pessoal (Exclusivo Secretaria) */}
              {eSecretaria && (
                <View style={estilos.blocoUsoPessoal}>
                  <Secao tema={tema} titulo="📝 Anotação de Uso Pessoal (Secretaria)" />
                  <Text style={estilos.dicaUsoPessoal}>
                    Espaço privativo para minutas e observações de trabalho. Visível somente para você.
                  </Text>
                  <TextInput
                    value={notaPessoal}
                    onChangeText={setNotaPessoal}
                    onBlur={salvarMinhaNota}
                    placeholder="Escreva anotações pessoais aqui..."
                    placeholderTextColor={tema.textoTerciario}
                    multiline
                    style={estilos.inputUsoPessoal}
                  />
                </View>
              )}

              {/* Trilha de Auditoria (Visível para DASI e Secretaria) */}
              {(eDasi || eSecretaria) && registro.atualizadoEm ? (
                <View style={estilos.blocoAuditoriaInfo}>
                  <Text style={estilos.textoAuditoria}>
                    🛡️ Última atualização por {registro.atualizadoPor?.nome || 'DASI'} em{' '}
                    {new Date(registro.atualizadoEm).toLocaleString('pt-BR')}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Rodapé de botões */}
            <View style={[estilos.rodape, { paddingBottom: insets.bottom + 8 }]}>
              {aoExcluir && !eChefeDgeo ? (
                <Pressable
                  onPress={() => aoExcluir(registro)}
                  style={estilos.botaoExcluir}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir competência">
                  <Text
                    style={estilos.textoBotaoExcluir}
                    maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                    Excluir
                  </Text>
                </Pressable>
              ) : null}

              {aoEditar && !eChefeDgeo ? (
                <Pressable
                  onPress={() => aoEditar(registro)}
                  style={estilos.botaoEditar}
                  accessibilityRole="button"
                  accessibilityLabel="Editar competência">
                  <Text
                    style={estilos.textoBotaoEditar}
                    maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                    Editar
                  </Text>
                </Pressable>
              ) : null}

              <Pressable onPress={aoFechar} style={estilos.botaoFechar} accessibilityRole="button">
                <Text style={estilos.textoBotaoFechar} maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                  Fechar
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const rotularUnidade = (sigla: string, nome: string): string =>
  [sigla, nome].filter(Boolean).join(' — ') || '—';

const Secao: React.FC<{ tema: Tema; titulo: string }> = ({ tema, titulo }) => {
  const estilos = criarEstilosBase(tema);
  return <Text style={estilos.secao}>{titulo}</Text>;
};

const Campo: React.FC<{
  tema: Tema;
  rotulo: string;
  valor: string;
  largo?: boolean;
  colunaDupla?: boolean;
}> = ({ tema, rotulo, valor, largo, colunaDupla }) => {
  const estilos = criarEstilosBase(tema);
  return (
    <View style={[estilos.bloco, colunaDupla && estilos.blocoColunaDupla, largo && estilos.blocoLargo]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor} selectable>
        {valor}
      </Text>
    </View>
  );
};

const criarEstilosBase = (tema: Tema) =>
  StyleSheet.create({
    secao: {
      width: '100%',
      color: tema.primaria,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: 20,
      marginBottom: 4,
    },
    bloco: { marginTop: 10, width: '100%' },
    blocoColunaDupla: { width: '48.5%' },
    blocoLargo: { width: '100%' },
    rotulo: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    valor: { color: tema.texto, fontSize: 14, lineHeight: 21 },
  });

const criarEstilosDetalhe = (
  tema: Tema,
  metricas: ReturnType<typeof useMetricas>,
  telaCheia: boolean,
) => {
  const ePC = metricas.expandida;

  return StyleSheet.create({
    fundo: {
      flex: 1,
      justifyContent: ePC ? 'center' : 'flex-end',
      alignItems: ePC ? 'center' : 'stretch',
      backgroundColor: tema.overlay,
      padding: ePC ? 20 : 0,
    },
    wrapperAnimado: {
      width: ePC ? '92%' : '100%',
      maxWidth: ePC ? 780 : undefined,
      height: ePC ? '86%' : telaCheia ? '100%' : '90%',
      maxHeight: ePC ? '90%' : telaCheia ? '100%' : '92%',
      flexShrink: 1,
    },
    painel: {
      flex: 1,
      backgroundColor: tema.fundoElevado,
      borderRadius: ePC ? 24 : telaCheia ? 0 : 26,
      borderTopLeftRadius: ePC ? 24 : telaCheia ? 0 : 26,
      borderTopRightRadius: ePC ? 24 : telaCheia ? 0 : 26,
      borderWidth: ePC ? 1 : 0,
      borderTopWidth: 1,
      borderColor: tema.borda,
      overflow: 'hidden',
    },
    areaPuxador: {
      alignItems: 'center',
      paddingVertical: 6,
      backgroundColor: tema.fundoElevado,
    },
    puxador: {
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: tema.bordaForte,
      marginBottom: 4,
    },
    dicaArrasto: {
      fontSize: 9,
      color: tema.textoTerciario,
      letterSpacing: 0.4,
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    selo: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    textoSelo: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    estrela: {
      fontSize: 22,
      color: tema.favorito,
    },
    botaoIcone: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoIcone: { color: tema.textoSecundario, fontSize: 14, fontWeight: '700' },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    conteudo: {
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    titulo: {
      color: tema.texto,
      fontSize: ePC ? 18 : 16,
      fontWeight: '700',
      lineHeight: 24,
      marginBottom: 10,
    },
    grade: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    blocoLargo: { width: '100%', marginTop: 8 },
    valor: { color: tema.texto, fontSize: 14, lineHeight: 21 },
    blocoAuditavel: {
      marginTop: 20,
      padding: 16,
      borderRadius: 16,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    listaComentarios: { marginTop: 10, gap: 10 },
    cartaoComentario: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    cabecalhoComentario: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    autorComentario: { color: tema.primariaTexto, fontSize: 11, fontWeight: '700' },
    dataComentario: { color: tema.textoTerciario, fontSize: 10 },
    textoComentario: { color: tema.texto, fontSize: 13, lineHeight: 18 },
    textoVazio: { color: tema.textoTerciario, fontSize: 12, fontStyle: 'italic', marginTop: 6 },
    areaNovoComentario: { marginTop: 12, gap: 8 },
    inputComentario: {
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      padding: 10,
      color: tema.texto,
      fontSize: 13,
      minHeight: 60,
    },
    botaoEnviarComentario: {
      alignSelf: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: tema.primaria,
    },
    textoBotaoEnviar: { color: tema.textoInvertido, fontSize: 12, fontWeight: '700' },
    blocoUsoPessoal: {
      marginTop: 20,
      padding: 16,
      borderRadius: 16,
      backgroundColor: tema.primariaFundo,
      borderWidth: 1,
      borderColor: tema.primaria,
    },
    dicaUsoPessoal: { color: tema.textoSecundario, fontSize: 11, marginBottom: 8 },
    inputUsoPessoal: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      padding: 10,
      color: tema.texto,
      fontSize: 13,
      minHeight: 70,
    },
    blocoAuditoriaInfo: {
      marginTop: 18,
      padding: 10,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoAuditoria: { color: tema.textoTerciario, fontSize: 11, fontStyle: 'italic' },
    rodape: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    botaoExcluir: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: tema.erroFundo,
    },
    textoBotaoExcluir: {
      color: tema.erro,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    botaoEditar: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoEditar: {
      color: tema.texto,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    botaoFechar: {
      flex: 1,
      minHeight: 44,
      backgroundColor: tema.primaria,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoBotaoFechar: {
      color: tema.textoInvertido,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
  });
};

export default DetalheRegistro;
