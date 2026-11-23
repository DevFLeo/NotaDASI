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
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '../auth/useSessao';
import ContatoProtegido from './ContatoProtegido';
import ModalParecerUrgencia, { type DadosParecerUrgencia } from './ModalParecerUrgencia';
import {
  calcularUrgencia,
  obterColunaKanban,
  rotuloColunaKanban,
  rotuloDecisaoParecer,
} from '../data/kanban';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  type ColunaKanban,
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
  aoAdicionarComentario?: (id: string, texto: string, numeroSei?: string) => void;
  aoSalvarNotaPessoal?: (id: string, texto: string) => void;
  aoRegistrarParecerUrgencia?: (id: string, dados: DadosParecerUrgencia) => void;
  aoMoverColunaKanban?: (
    id: string,
    coluna: ColunaKanban | undefined,
    responsavelContinuidade?: string,
  ) => void;
  aoNavegarAnterior?: () => void;
  aoNavegarProximo?: () => void;
  indiceNoSetor?: number;
  totalNoSetor?: number;
};

const DetalheRegistro: React.FC<Props> = ({
  registro,
  aoFechar,
  aoEditar,
  aoExcluir,
  aoAlternarFavorito,
  aoAdicionarComentario,
  aoSalvarNotaPessoal,
  aoRegistrarParecerUrgencia,
  aoMoverColunaKanban,
  aoNavegarAnterior,
  aoNavegarProximo,
  indiceNoSetor,
  totalNoSetor,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const insets = useSafeAreaInsets();
  const { contaAtual } = useSessao();
  const { gesto, estiloArrasto, telaCheia, alternarTelaCheia } = useArrastarParaFechar(aoFechar);

  const [novoComentario, setNovoComentario] = useState('');
  const [seiComentario, setSeiComentario] = useState('');
  const [modalParecerAberto, setModalParecerAberto] = useState(false);
  const [notaPessoal, setNotaPessoal] = useState(() =>
    registro && contaAtual ? registro.notasPessoais?.[contaAtual.usuario] ?? '' : '',
  );

  const eChefeDgeo = contaAtual?.papel === 'gerente';
  const eSecretaria = contaAtual?.papel === 'secretario';
  const eDasi = contaAtual?.papel === 'dasi' || (!eChefeDgeo && !eSecretaria);

  useEffect(() => {
    if (Platform.OS !== 'web' || !registro || modalParecerAberto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
        return;
      }
      if (!isInput && e.key === 'ArrowLeft' && aoNavegarAnterior) {
        e.preventDefault();
        aoNavegarAnterior();
        return;
      }
      if (!isInput && e.key === 'ArrowRight' && aoNavegarProximo) {
        e.preventDefault();
        aoNavegarProximo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        if (aoEditar && !eChefeDgeo) {
          aoEditar(registro);
        }
        return;
      }
      if (!isInput && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        aoAlternarFavorito?.(registro);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aoFechar, aoEditar, aoAlternarFavorito, aoNavegarAnterior, aoNavegarProximo, eChefeDgeo, modalParecerAberto, registro]);

  if (!registro) {
    return null;
  }

  const situacao = calcularSituacao(registro);
  const corSituacao = corPorSituacao[situacao];
  const urgencia = calcularUrgencia(registro);
  const colunaKanban = obterColunaKanban(registro);

  const ePC = metricas.expandida;
  const estilos = criarEstilosDetalhe(tema, metricas, telaCheia);

  const enviarComentario = () => {
    if (!novoComentario.trim() || !aoAdicionarComentario) return;
    aoAdicionarComentario(
      registro.id,
      novoComentario.trim(),
      seiComentario.trim() || undefined,
    );
    setNovoComentario('');
    setSeiComentario('');
  };

  const salvarMinhaNota = () => {
    if (aoSalvarNotaPessoal) {
      aoSalvarNotaPessoal(registro.id, notaPessoal);
    }
  };

  const copiarTexto = (texto: string, rotulo: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto);
      Alert.alert('Copiado', `${rotulo} copiado para a área de transferência.`);
    }
  };

  const temContatosInstitucionais = Boolean(
    registro.contatoInstitucional?.email ||
      registro.contatoInstitucional?.telefone ||
      registro.contatoInstitucional?.ramal,
  );

  return (
    <Modal
      visible
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
      transparent
      onRequestClose={aoFechar}>
      <GestureHandlerRootView style={estilos.fundo}>
        {/* Backdrop escurecido clicável: fecha o modal imediatamente ao clicar fora */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={aoFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar detalhes ao clicar fora"
        />

        <Animated.View style={[estilos.wrapperAnimado, estiloArrasto]}>
          <View style={estilos.painel}>
            {/* Puxador para expandir / reduzir */}
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

            {/* Cabeçalho com Status e Ações */}
            <View style={estilos.cabecalho}>
              <View style={estilos.cabecalhoEsquerda}>
                <View
                  style={[
                    estilos.seloStatus,
                    {
                      backgroundColor: `${corSituacao}18`,
                      borderColor: `${corSituacao}40`,
                    },
                  ]}>
                  <View style={[estilos.pontoStatus, { backgroundColor: corSituacao }]} />
                  <Text style={[estilos.textoSeloStatus, { color: corSituacao }]}>
                    {rotuloSituacao[situacao].toUpperCase()}
                  </Text>
                </View>

                <Text style={estilos.subtituloHeader} numberOfLines={1}>
                  {registro.departamentoSigla || 'PREFEITURA'} • {registro.setorSigla || 'SETOR'}
                </Text>
              </View>

              <View style={estilos.acoesTopo}>
                {/* Navegador entre competências do mesmo setor */}
                {aoNavegarAnterior && aoNavegarProximo && totalNoSetor && totalNoSetor > 1 ? (
                  <View style={estilos.faixaNavegacao}>
                    <Pressable
                      onPress={aoNavegarAnterior}
                      accessibilityRole="button"
                      accessibilityLabel="Competência anterior (Seta esquerda)"
                      {...(Platform.OS === 'web' ? { title: 'Anterior [←]' } : {})}
                      style={estilos.botaoNavegacao}>
                      <Text style={estilos.textoBotaoNavegacao}>‹</Text>
                    </Pressable>
                    <Text style={estilos.textoContadorNavegacao}>
                      {(indiceNoSetor ?? 0) + 1}/{totalNoSetor}
                    </Text>
                    <Pressable
                      onPress={aoNavegarProximo}
                      accessibilityRole="button"
                      accessibilityLabel="Próxima competência (Seta direita)"
                      {...(Platform.OS === 'web' ? { title: 'Próxima [→]' } : {})}
                      style={estilos.botaoNavegacao}>
                      <Text style={estilos.textoBotaoNavegacao}>›</Text>
                    </Pressable>
                  </View>
                ) : null}

                {aoAlternarFavorito ? (
                  <Pressable
                    onPress={() => aoAlternarFavorito(registro)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      registro.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'
                    }
                    hitSlop={10}
                    style={estilos.botaoIcone}>
                    <Text style={[estilos.estrela, registro.favorito && estilos.estrelaAtiva]}>
                      {registro.favorito ? '★' : '☆'}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={alternarTelaCheia}
                  accessibilityRole="button"
                  accessibilityLabel={telaCheia ? 'Restaurar tamanho' : 'Tela cheia'}
                  style={estilos.botaoIcone}>
                  <Text style={estilos.textoBotaoIcone}>{telaCheia ? '[-]' : '[+]'}</Text>
                </Pressable>

                <Pressable
                  onPress={aoFechar}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar modal"
                  style={estilos.botaoIconeFechar}>
                  <Text style={estilos.textoBotaoIconeFechar}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Conteúdo rolável */}
            <ScrollView
              style={estilos.scroll}
              contentContainerStyle={estilos.conteudo}
              showsVerticalScrollIndicator>
              {/* Card Hero: Atribuição Regimental */}
              <View style={estilos.cardHero}>
                <View style={estilos.linhaHeroTopo}>
                  <Text style={estilos.tagHero}>ATRIBUIÇÃO REGIMENTAL AVALIADA</Text>
                  <View style={estilos.grupoHeroDireita}>
                    {registro.numeroSei ? (
                      <Pressable
                        onPress={() => copiarTexto(registro.numeroSei || '', 'Número do SEI')}
                        style={estilos.badgeSeiHero}>
                        <Text style={estilos.textoBadgeSeiHero}>SEI: {registro.numeroSei}</Text>
                      </Pressable>
                    ) : null}
                    <Text style={estilos.idRegistro}>ID: {registro.id}</Text>
                  </View>
                </View>
                <Text style={estilos.tituloCompetencia} selectable>
                  {registro.competencia}
                </Text>
              </View>

              {/* Grade de Cards Dashboard */}
              <View style={[estilos.gradeCards, ePC && estilos.gradeCardsPC]}>
                {/* ──────────────── COLUNA 1 ──────────────── */}
                <View style={[estilos.colunaCard, ePC && estilos.colunaCardPC]}>
                  {/* Card: Lotação e Chefia Responsável */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Lotação & Responsáveis</Text>
                        <Text style={estilos.subtituloSecao}>Estrutura Organizacional da Prefeitura</Text>
                      </View>
                    </View>

                    {/* Departamento */}
                    <View style={estilos.blocoUnidade}>
                      <View style={estilos.linhaRotuloTag}>
                        <Text style={estilos.rotuloCampo}>Departamento</Text>
                        {registro.departamentoSigla ? (
                          <View style={estilos.tagSigla}>
                            <Text style={estilos.textoTagSigla}>{registro.departamentoSigla}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={estilos.valorPrincipal} selectable>
                        {registro.departamento || '—'}
                      </Text>

                      <View style={estilos.linhaChefia}>
                        <Text style={estilos.valorChefia} selectable>
                          <Text style={estilos.cargoDestaque}>
                            {registro.departamentoCargo || 'Direção'}:{' '}
                          </Text>
                          {registro.departamentoResponsavel || 'Não informado'}
                        </Text>
                      </View>
                    </View>

                    {/* Divisor suave */}
                    <View style={estilos.divisorCard} />

                    {/* Setor */}
                    <View style={estilos.blocoUnidade}>
                      <View style={estilos.linhaRotuloTag}>
                        <Text style={estilos.rotuloCampo}>Setor / Divisão</Text>
                        {registro.setorSigla ? (
                          <View style={[estilos.tagSigla, { backgroundColor: '#3b82f615' }]}>
                            <Text style={[estilos.textoTagSigla, { color: '#2563eb' }]}>
                              {registro.setorSigla}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={estilos.valorPrincipal} selectable>
                        {registro.setor || '—'}
                      </Text>

                      <View style={estilos.linhaChefia}>
                        <Text style={estilos.valorChefia} selectable>
                          <Text style={estilos.cargoDestaque}>{registro.cargo || 'Responsável'}: </Text>
                          {registro.responsavel || 'Não informado'}
                        </Text>
                      </View>
                    </View>

                    {/* Canais de Contato Institucional */}
                    <View style={estilos.secaoContatosCard}>
                      <Text style={estilos.rotuloCampo}>Canais de Contato Institucional</Text>
                      {temContatosInstitucionais ? (
                        <View style={estilos.faixaPillsContato}>
                          {registro.contatoInstitucional?.telefone ? (
                            <Pressable
                              onPress={() =>
                                copiarTexto(
                                  registro.contatoInstitucional?.telefone || '',
                                  'Telefone institucional',
                                )
                              }
                              style={estilos.pillContato}>
                              <Text style={estilos.textoContatoPill} selectable>
                                Tel: {registro.contatoInstitucional.telefone}
                              </Text>
                            </Pressable>
                          ) : null}

                          {registro.contatoInstitucional?.ramal ? (
                            <View style={estilos.pillContatoRamal}>
                              <Text style={estilos.textoContatoRamal}>
                                Ramal {registro.contatoInstitucional.ramal}
                              </Text>
                            </View>
                          ) : null}

                          {registro.contatoInstitucional?.email ? (
                            <Pressable
                              onPress={() =>
                                copiarTexto(
                                  registro.contatoInstitucional?.email || '',
                                  'E-mail institucional',
                                )
                              }
                              style={estilos.pillContato}>
                              <Text style={estilos.textoContatoPill} selectable>
                                E-mail: {registro.contatoInstitucional.email}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : (
                        <View style={estilos.alertaSemContato}>
                          <Text style={estilos.textoAlertaSemContato}>
                            Contato institucional pendente de adesão no diagnóstico.
                          </Text>
                        </View>
                      )}

                      {/* Contato pessoal protegido */}
                      <ContatoProtegido contato={registro.contatoPessoal} />
                    </View>
                  </View>

                  {/* Card: Diagnóstico de Adesão ao SIG Geo 360 */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Diagnóstico do SIG Geo 360</Text>
                        <Text style={estilos.subtituloSecao}>Respostas da adesão setorial</Text>
                      </View>
                    </View>

                    <View style={estilos.gradePillsStatus}>
                      <PillStatus
                        rotulo="O Sistema Atende?"
                        valor={registro.sistemaAtende}
                        textoSim="Atende"
                        textoNao="Não Atende"
                      />
                      <PillStatus
                        rotulo="Já Estruturado no SIG?"
                        valor={registro.estruturadoNoSistema}
                        textoSim="Estruturado"
                        textoNao="Não Estruturado"
                      />
                      <PillStatus
                        rotulo="Houve Treinamento?"
                        valor={registro.houveTreinamento}
                        textoSim="Treinado"
                        textoNao="Pendente"
                      />
                    </View>

                    {registro.comoAtende ? (
                      <View style={estilos.caixaExplicacao}>
                        <Text style={estilos.rotuloCaixaExplicacao}>De que forma atende:</Text>
                        <Text style={estilos.textoExplicacao} selectable>
                          "{registro.comoAtende}"
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Card: Problemas e Chamados Técnicos */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Situação Operacional & Chamados</Text>
                        <Text style={estilos.subtituloSecao}>Ocorrências reportadas no SIG</Text>
                      </View>
                    </View>

                    <View style={estilos.gradePillsStatus}>
                      <PillStatus
                        rotulo="Tem Problema no SIG?"
                        valor={registro.temProblema}
                        textoSim="Com Problema"
                        textoNao="Sem Problema"
                        invertido
                      />
                      <PillStatus
                        rotulo="Chamado Aberto?"
                        valor={registro.temChamado}
                        textoSim="Chamado Aberto"
                        textoNao="Sem Chamado"
                      />
                    </View>

                    {registro.temProblema || registro.detalheProblema ? (
                      <View style={estilos.caixaAlertaProblema}>
                        <Text style={estilos.tituloAlertaProblema}>
                          Detalhamento do Impedimento Técnico:
                        </Text>
                        <Text style={estilos.textoDetalheProblema} selectable>
                          {registro.detalheProblema || 'Problema assinalado sem descrição formal.'}
                        </Text>
                      </View>
                    ) : (
                      <View style={estilos.caixaSemProblema}>
                        <Text style={estilos.textoSemProblema}>
                          Sem impedimentos operacionais registrados para esta competência.
                        </Text>
                      </View>
                    )}

                    {registro.observacao ? (
                      <View style={estilos.caixaObservacao}>
                        <Text style={estilos.rotuloCaixaExplicacao}>Observações Adicionais:</Text>
                        <Text style={estilos.textoObservacao} selectable>
                          {registro.observacao}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* ──────────────── COLUNA 2 ──────────────── */}
                <View style={[estilos.colunaCard, ePC && estilos.colunaCardPC]}>
                  {/* Card: Camadas Espaciais & Módulos */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Camadas & Módulos do SIG</Text>
                        <Text style={estilos.subtituloSecao}>Permissões e fluxos de trabalho</Text>
                      </View>
                    </View>

                    <View style={estilos.linhaDuplaCampos}>
                      <View style={estilos.campoMetade}>
                        <Text style={estilos.rotuloCampo}>Módulo do SIG</Text>
                        <View style={estilos.tagModulo}>
                          <Text style={estilos.textoTagModulo} numberOfLines={1}>
                            {registro.moduloSig || 'Cadastro padrão'}
                          </Text>
                        </View>
                      </View>

                      <View style={estilos.campoMetade}>
                        <Text style={estilos.rotuloCampo}>Nível de Acesso (Módulo)</Text>
                        <BadgeNivel nivel={registro.nivelAcessoModulo || 'Leitor'} />
                      </View>
                    </View>

                    <View style={[estilos.linhaDuplaCampos, { marginTop: 12 }]}>
                      <View style={estilos.campoMetade}>
                        <Text style={estilos.rotuloCampo}>Camadas Acessadas</Text>
                        <Text style={estilos.valorPrincipal} selectable>
                          {registro.informacoesAcessadas || 'Nenhuma'}
                        </Text>
                      </View>

                      <View style={estilos.campoMetade}>
                        <Text style={estilos.rotuloCampo}>Nível de Acesso (Camada)</Text>
                        <BadgeNivel nivel={registro.nivelAcessoCamada || 'Leitor'} />
                      </View>
                    </View>

                    <View style={estilos.gradePillsStatus}>
                      <PillStatus
                        rotulo="Acesso à Camada Concedido?"
                        valor={registro.acessoCamadaConcedido}
                        textoSim="Concedido"
                        textoNao="Não Concedido"
                      />
                      <PillStatus
                        rotulo="Iniciou a Atividade?"
                        valor={registro.iniciouAtividade}
                        textoSim="Em Produção"
                        textoNao="Não Iniciou"
                      />
                    </View>
                  </View>

                  {/* Card: Fluxo Kanban & Urgência */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Fluxo Kanban & Urgência</Text>
                        <Text style={estilos.subtituloSecao}>
                          Etapa atual, índice calculado e encaminhamento
                        </Text>
                      </View>
                      <View style={estilos.badgeEtapaKanban}>
                        <Text style={estilos.textoBadgeEtapaKanban}>
                          {rotuloColunaKanban[colunaKanban]}
                        </Text>
                      </View>
                    </View>

                    <View style={estilos.blocoResumoKanban}>
                      <Text style={estilos.textoIndiceKanban}>
                        Índice de urgência calculado: {urgencia.pontuacao} pts
                      </Text>
                      {urgencia.fatores.length > 0 ? (
                        <View style={estilos.faixaFatoresDetalhe}>
                          {urgencia.fatores.map((f) => (
                            <View key={f.codigo} style={estilos.tagFatorDetalhe}>
                              <Text style={estilos.textoTagFatorDetalhe}>
                                {f.rotulo} (+{f.peso})
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={estilos.textoSemFatoresDetalhe}>
                          Sem fatores negativos pendentes.
                        </Text>
                      )}

                      {registro.kanban?.responsavelContinuidade ? (
                        <Text style={estilos.textoContinuidadeDetalhe}>
                          Responsável pela continuidade: {registro.kanban.responsavelContinuidade}
                        </Text>
                      ) : null}
                    </View>

                    {registro.kanban?.pareceresUrgencia &&
                    registro.kanban.pareceresUrgencia.length > 0 ? (
                      <View style={estilos.listaPareceresKanban}>
                        {registro.kanban.pareceresUrgencia.map((p) => (
                          <View key={p.id} style={estilos.itemParecerKanban}>
                            <View style={estilos.linhaTopoParecerKanban}>
                              <Text style={estilos.decisaoParecerKanban}>
                                {rotuloDecisaoParecer[p.decisao]}
                              </Text>
                              <Text style={estilos.dataComentario}>
                                {new Date(p.dataHora).toLocaleDateString('pt-BR')} · {p.nome}
                              </Text>
                            </View>
                            {p.numeroSei ? (
                              <Text style={estilos.seiParecerKanban}>SEI: {p.numeroSei}</Text>
                            ) : null}
                            {p.responsavelContinuidade ? (
                              <Text style={estilos.continuidadeParecerKanban}>
                                Continuidade: {p.responsavelContinuidade}
                              </Text>
                            ) : null}
                            <Text style={estilos.textoComentario} selectable>
                              {p.parecer}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {aoRegistrarParecerUrgencia || aoMoverColunaKanban ? (
                      <View style={estilos.faixaAcoesKanban}>
                        {aoRegistrarParecerUrgencia ? (
                          <Pressable
                            onPress={() => setModalParecerAberto(true)}
                            style={estilos.botaoParecerDetalhe}>
                            <Text style={estilos.textoBotaoParecerDetalhe}>
                              Emitir Parecer / Encaminhar
                            </Text>
                          </Pressable>
                        ) : null}
                        {aoMoverColunaKanban && registro.kanban?.colunaManual ? (
                          <Pressable
                            onPress={() => aoMoverColunaKanban(registro.id, undefined)}
                            style={estilos.botaoAutoKanban}>
                            <Text style={estilos.textoBotaoAutoKanban}>
                              Restaurar cálculo automático
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Card: Pareceres & Comentários Oficiais */}
                  <View style={estilos.card}>
                    <View style={estilos.cabecalhoCard}>
                      <View style={estilos.titulosCard}>
                        <Text style={estilos.tituloSecao}>Pareceres & Comentários</Text>
                        <Text style={estilos.subtituloSecao}>
                          Governança auditável (DASI, Chefe DGEO, Secretaria)
                        </Text>
                      </View>
                    </View>

                    {registro.comentarios && registro.comentarios.length > 0 ? (
                      <View style={estilos.listaComentarios}>
                        {registro.comentarios.map((c) => {
                          const corPapel =
                            c.papel === 'dasi'
                              ? '#059669'
                              : c.papel === 'gerente'
                              ? '#2563eb'
                              : '#d97706';
                          return (
                            <View key={c.id} style={estilos.cartaoComentario}>
                              <View style={estilos.cabecalhoComentario}>
                                <View
                                  style={[
                                    estilos.tagPapelComentario,
                                    { backgroundColor: `${corPapel}15` },
                                  ]}>
                                  <Text style={[estilos.textoPapelComentario, { color: corPapel }]}>
                                    {c.papel.toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={estilos.autorComentario}>
                                  {c.nome || c.usuario}
                                </Text>
                                <Text style={estilos.dataComentario}>
                                  {new Date(c.dataHora).toLocaleDateString('pt-BR')}
                                </Text>
                              </View>
                              {c.numeroSei ? (
                                <Pressable
                                  onPress={() => copiarTexto(c.numeroSei || '', 'Número do SEI')}
                                  style={estilos.badgeSeiComentario}>
                                  <Text style={estilos.textoBadgeSeiComentario}>
                                    SEI: {c.numeroSei}
                                  </Text>
                                </Pressable>
                              ) : null}
                              <Text style={estilos.textoComentario} selectable>
                                {c.texto}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={estilos.caixaVazioComentarios}>
                        <Text style={estilos.textoVazio}>
                          Nenhum parecer registrado para esta competência.
                        </Text>
                      </View>
                    )}

                    {/* Caixa para novo comentário */}
                    <View style={estilos.areaNovoComentario}>
                      <TextInput
                        value={seiComentario}
                        onChangeText={setSeiComentario}
                        placeholder="Número do SEI (opcional) — Ex.: 00600-00012345/2026-01"
                        placeholderTextColor={tema.textoTerciario}
                        style={estilos.inputSeiComentario}
                      />
                      <TextInput
                        value={novoComentario}
                        onChangeText={setNovoComentario}
                        placeholder={`Comentar como ${contaAtual?.nome || 'DASI'}...`}
                        placeholderTextColor={tema.textoTerciario}
                        multiline
                        style={estilos.inputComentario}
                      />
                      <Pressable
                        onPress={enviarComentario}
                        disabled={!novoComentario.trim()}
                        style={[
                          estilos.botaoEnviarComentario,
                          !novoComentario.trim() && estilos.botaoDesabilitado,
                        ]}>
                        <Text style={estilos.textoBotaoEnviar}>Enviar Parecer</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Card: Anotações Privativas da Secretaria */}
                  {eSecretaria && (
                    <View style={[estilos.card, { borderColor: '#8b5cf644', backgroundColor: '#8b5cf608' }]}>
                      <View style={estilos.cabecalhoCard}>
                        <View style={estilos.titulosCard}>
                          <Text style={[estilos.tituloSecao, { color: '#7c3aed' }]}>
                            Anotação Pessoal (Secretaria)
                          </Text>
                          <Text style={estilos.subtituloSecao}>
                            Minuta privada salva exclusivamente neste dispositivo
                          </Text>
                        </View>
                      </View>
                      <TextInput
                        value={notaPessoal}
                        onChangeText={setNotaPessoal}
                        onBlur={salvarMinhaNota}
                        placeholder="Escreva minutas ou notas de trabalho particulares..."
                        placeholderTextColor={tema.textoTerciario}
                        multiline
                        style={estilos.inputUsoPessoal}
                      />
                    </View>
                  )}

                  {/* Trilha de Auditoria */}
                  {(eDasi || eSecretaria) && registro.atualizadoEm ? (
                    <View style={estilos.blocoAuditoriaInfo}>
                      <Text style={estilos.textoAuditoria}>
                        Última alteração auditada por{' '}
                        <Text style={estilos.destaqueAuditoria}>
                          {registro.atualizadoPor?.nome || 'DASI'}
                        </Text>{' '}
                        em {new Date(registro.atualizadoEm).toLocaleString('pt-BR')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            {/* Rodapé de Ações com Alto Contraste e Hierarquia Visual */}
            <View style={[estilos.rodape, { paddingBottom: insets.bottom + 12 }]}>
              {aoExcluir && !eChefeDgeo ? (
                <Pressable
                  onPress={() => aoExcluir(registro)}
                  style={estilos.botaoExcluir}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir competência">
                  <Text style={estilos.textoBotaoExcluir}>EXCLUIR</Text>
                </Pressable>
              ) : null}

              {ePC && aoNavegarAnterior && aoNavegarProximo && totalNoSetor && totalNoSetor > 1 ? (
                <View style={estilos.grupoNavRodape}>
                  <Pressable
                    onPress={aoNavegarAnterior}
                    style={estilos.botaoNavRodape}
                    accessibilityRole="button"
                    accessibilityLabel="Competência anterior (Seta esquerda)"
                    {...(Platform.OS === 'web' ? { title: 'Anterior [←]' } : {})}>
                    <Text style={estilos.textoBotaoNavRodape}>← Ant.</Text>
                  </Pressable>
                  <Text style={estilos.textoContadorRodape}>
                    {(indiceNoSetor ?? 0) + 1}/{totalNoSetor}
                  </Text>
                  <Pressable
                    onPress={aoNavegarProximo}
                    style={estilos.botaoNavRodape}
                    accessibilityRole="button"
                    accessibilityLabel="Próxima competência (Seta direita)"
                    {...(Platform.OS === 'web' ? { title: 'Próxima [→]' } : {})}>
                    <Text style={estilos.textoBotaoNavRodape}>Próx. →</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={aoFechar}
                style={estilos.botaoFechar}
                accessibilityRole="button">
                <Text style={estilos.textoBotaoFechar}>{ePC ? 'FECHAR [Esc]' : 'FECHAR'}</Text>
              </Pressable>

              {aoEditar && !eChefeDgeo ? (
                <Pressable
                  onPress={() => aoEditar(registro)}
                  style={estilos.botaoEditar}
                  accessibilityRole="button"
                  accessibilityLabel="Editar competência (Ctrl+E)">
                  <Text style={estilos.textoBotaoEditar}>{ePC ? 'EDITAR [Ctrl+E]' : 'EDITAR'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </GestureHandlerRootView>

      {aoRegistrarParecerUrgencia ? (
        <ModalParecerUrgencia
          registro={registro}
          visivel={modalParecerAberto}
          aoFechar={() => setModalParecerAberto(false)}
          aoConfirmar={(id, dados) => {
            aoRegistrarParecerUrgencia(id, dados);
            setModalParecerAberto(false);
          }}
        />
      ) : null}
    </Modal>
  );
};

/** Componente de Pill Status com Ícone Visual e Cor Semântica */
const PillStatus: React.FC<{
  rotulo: string;
  valor?: boolean;
  textoSim?: string;
  textoNao?: string;
  textoNeutro?: string;
  invertido?: boolean;
}> = ({
  rotulo,
  valor,
  textoSim = 'Sim',
  textoNao = 'Não',
  textoNeutro = 'Não informado',
  invertido = false,
}) => {
  let corFundo = '#94a3b814';
  let corBorda = '#94a3b830';
  let corTexto = '#64748b';
  let texto = textoNeutro;
  let icone = '—';

  if (valor === true) {
    if (invertido) {
      corFundo = '#ef444415';
      corBorda = '#ef444440';
      corTexto = '#dc2626';
      texto = textoSim;
      icone = '!';
    } else {
      corFundo = '#10b98115';
      corBorda = '#10b98140';
      corTexto = '#059669';
      texto = textoSim;
      icone = '✓';
    }
  } else if (valor === false) {
    if (invertido) {
      corFundo = '#10b98115';
      corBorda = '#10b98140';
      corTexto = '#059669';
      texto = textoNao;
      icone = '✓';
    } else {
      corFundo = '#f1f5f9';
      corBorda = '#cbd5e1';
      corTexto = '#475569';
      texto = textoNao;
      icone = '✕';
    }
  }

  return (
    <View style={estilosPill.container}>
      <Text style={estilosPill.rotulo} numberOfLines={1}>
        {rotulo}
      </Text>
      <View style={[estilosPill.badge, { backgroundColor: corFundo, borderColor: corBorda }]}>
        <Text style={[estilosPill.icone, { color: corTexto }]}>{icone}</Text>
        <Text style={[estilosPill.texto, { color: corTexto }]} numberOfLines={1}>
          {texto}
        </Text>
      </View>
    </View>
  );
};

const estilosPill = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 105,
    marginTop: 6,
  },
  rotulo: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  icone: {
    fontSize: 12,
    fontWeight: '800',
  },
  texto: {
    fontSize: 12,
    fontWeight: '700',
  },
});

/** Badge elegante para Níveis de Acesso */
const BadgeNivel: React.FC<{ nivel: string }> = ({ nivel }) => {
  const norm = (nivel || '').toLowerCase();
  let corFundo = '#3b82f615';
  let corBorda = '#3b82f635';
  let corTexto = '#2563eb';

  if (norm.includes('ediç') || norm.includes('edicao') || norm.includes('operador')) {
    corFundo = '#8b5cf615';
    corBorda = '#8b5cf635';
    corTexto = '#7c3aed';
  } else if (norm.includes('admin') || norm.includes('gestor')) {
    corFundo = '#10b98115';
    corBorda = '#10b98135';
    corTexto = '#059669';
  }

  return (
    <View style={[estilosBadge.container, { backgroundColor: corFundo, borderColor: corBorda }]}>
      <Text style={[estilosBadge.texto, { color: corTexto }]}>{nivel || 'Leitor'}</Text>
    </View>
  );
};

const estilosBadge = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 2,
  },
  texto: {
    fontSize: 12,
    fontWeight: '700',
  },
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
      padding: ePC ? 24 : 0,
    },
    wrapperAnimado: {
      width: ePC ? '94%' : '100%',
      maxWidth: ePC ? 880 : undefined,
      height: ePC ? '88%' : telaCheia ? '100%' : '92%',
      maxHeight: ePC ? '90%' : telaCheia ? '100%' : '94%',
      flexShrink: 1,
    },
    painel: {
      flex: 1,
      backgroundColor: tema.fundo,
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
      width: 48,
      height: 5,
      borderRadius: 999,
      backgroundColor: tema.bordaForte,
      marginBottom: 3,
    },
    dicaArrasto: {
      fontSize: 9,
      color: tema.textoTerciario,
      letterSpacing: 0.3,
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    cabecalhoEsquerda: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    seloStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    pontoStatus: {
      width: 7,
      height: 7,
      borderRadius: 999,
    },
    textoSeloStatus: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    subtituloHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: tema.textoTerciario,
      flexShrink: 1,
    },
    acoesTopo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    faixaNavegacao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    botaoNavegacao: {
      width: 24,
      height: 24,
      borderRadius: 6,
      backgroundColor: tema.fundoElevado,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoNavegacao: {
      fontSize: 14,
      fontWeight: '800',
      color: tema.texto,
      lineHeight: 16,
    },
    textoContadorNavegacao: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.textoSecundario,
      paddingHorizontal: 4,
    },
    estrela: {
      fontSize: 20,
      color: tema.textoTerciario,
    },
    estrelaAtiva: {
      color: '#f59e0b',
    },
    botaoIcone: {
      width: ePC ? 32 : 38,
      height: ePC ? 32 : 38,
      borderRadius: 9,
      backgroundColor: tema.superficie,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoIcone: {
      color: tema.textoSecundario,
      fontSize: 13,
      fontWeight: '700',
    },
    botaoIconeFechar: {
      width: ePC ? 32 : 38,
      height: ePC ? 32 : 38,
      borderRadius: 9,
      backgroundColor: tema.superficie,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoIconeFechar: {
      color: tema.texto,
      fontSize: 13,
      fontWeight: '700',
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    conteudo: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 32,
    },

    // Hero Card da Competência
    cardHero: {
      backgroundColor: tema.fundoElevado,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    linhaHeroTopo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    tagHero: {
      fontSize: 10,
      fontWeight: '800',
      color: tema.primaria,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    idRegistro: {
      fontSize: 10,
      fontWeight: '600',
      color: tema.textoTerciario,
    },
    tituloCompetencia: {
      fontSize: ePC ? 17 : 15,
      fontWeight: '700',
      color: tema.texto,
      lineHeight: 23,
    },

    // Layout de Grade de Cards
    gradeCards: {
      flexDirection: 'column',
      gap: 14,
    },
    gradeCardsPC: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    colunaCard: {
      flex: 1,
      gap: 14,
    },
    colunaCardPC: {
      width: '49%',
      flexShrink: 1,
    },

    // Card Padrão do Dashboard
    card: {
      backgroundColor: tema.fundoElevado,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 16,
    },
    cabecalhoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    iconeCard: {
      fontSize: 18,
    },
    titulosCard: {
      flex: 1,
    },
    tituloSecao: {
      fontSize: 13,
      fontWeight: '800',
      color: tema.texto,
      letterSpacing: -0.2,
    },
    subtituloSecao: {
      fontSize: 11,
      color: tema.textoTerciario,
      marginTop: 1,
    },
    divisorCard: {
      height: 1,
      backgroundColor: tema.borda,
      marginVertical: 12,
    },

    // Elementos da Lotação
    blocoUnidade: {
      gap: 4,
    },
    linhaRotuloTag: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rotuloCampo: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoTerciario,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    tagSigla: {
      backgroundColor: tema.primariaFundo,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    textoTagSigla: {
      fontSize: 10,
      fontWeight: '800',
      color: tema.primaria,
    },
    valorPrincipal: {
      fontSize: 13,
      fontWeight: '600',
      color: tema.texto,
      lineHeight: 19,
    },
    linhaChefia: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      backgroundColor: tema.superficie,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    iconePessoa: {
      fontSize: 12,
    },
    valorChefia: {
      fontSize: 12,
      color: tema.textoSecundario,
      flex: 1,
    },
    cargoDestaque: {
      fontWeight: '700',
      color: tema.texto,
    },

    // Contatos
    secaoContatosCard: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
    },
    faixaPillsContato: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    pillContato: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: tema.superficie,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    iconeContatoPill: {
      fontSize: 12,
    },
    textoContatoPill: {
      fontSize: 12,
      fontWeight: '600',
      color: tema.texto,
    },
    pillContatoRamal: {
      backgroundColor: tema.primariaFundo,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 8,
      justifyContent: 'center',
    },
    textoContatoRamal: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.primaria,
    },
    alertaSemContato: {
      backgroundColor: '#f59e0b12',
      borderWidth: 1,
      borderColor: '#f59e0b35',
      borderRadius: 8,
      padding: 8,
      marginTop: 6,
    },
    textoAlertaSemContato: {
      fontSize: 11,
      color: '#b45309',
      fontWeight: '600',
    },

    // Pills de Status
    gradePillsStatus: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    caixaExplicacao: {
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    rotuloCaixaExplicacao: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoTerciario,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    textoExplicacao: {
      fontSize: 12,
      color: tema.textoSecundario,
      fontStyle: 'italic',
      lineHeight: 18,
    },

    // Problemas
    caixaAlertaProblema: {
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#ef444410',
      borderWidth: 1,
      borderColor: '#ef444435',
    },
    tituloAlertaProblema: {
      fontSize: 11,
      fontWeight: '800',
      color: '#dc2626',
      marginBottom: 4,
    },
    textoDetalheProblema: {
      fontSize: 12,
      color: '#b91c1c',
      lineHeight: 17,
      fontWeight: '500',
    },
    caixaSemProblema: {
      marginTop: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: '#10b98110',
      borderWidth: 1,
      borderColor: '#10b98130',
    },
    textoSemProblema: {
      fontSize: 11,
      fontWeight: '600',
      color: '#059669',
    },
    caixaObservacao: {
      marginTop: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoObservacao: {
      fontSize: 12,
      color: tema.textoSecundario,
      lineHeight: 17,
    },

    // Camadas e Módulos
    linhaDuplaCampos: {
      flexDirection: 'row',
      gap: 12,
    },
    campoMetade: {
      flex: 1,
    },
    tagModulo: {
      backgroundColor: tema.superficie,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tema.borda,
      marginTop: 2,
    },
    textoTagModulo: {
      fontSize: 12,
      fontWeight: '600',
      color: tema.texto,
    },

    // Pareceres e Comentários
    listaComentarios: {
      gap: 8,
    },
    cartaoComentario: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    cabecalhoComentario: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    tagPapelComentario: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    textoPapelComentario: {
      fontSize: 9,
      fontWeight: '800',
    },
    autorComentario: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.texto,
      flex: 1,
    },
    dataComentario: {
      fontSize: 10,
      color: tema.textoTerciario,
    },
    textoComentario: {
      fontSize: 12,
      color: tema.textoSecundario,
      lineHeight: 17,
    },
    caixaVazioComentarios: {
      padding: 12,
      alignItems: 'center',
      backgroundColor: tema.superficie,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoVazio: {
      color: tema.textoTerciario,
      fontSize: 11,
      fontStyle: 'italic',
    },
    areaNovoComentario: {
      marginTop: 12,
      gap: 8,
    },
    inputComentario: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      padding: 10,
      color: tema.texto,
      fontSize: 12,
      minHeight: 52,
    },
    botaoEnviarComentario: {
      alignSelf: 'flex-end',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: tema.primaria,
    },
    botaoDesabilitado: {
      opacity: 0.5,
    },
    textoBotaoEnviar: {
      color: tema.textoInvertido,
      fontSize: 11,
      fontWeight: '700',
    },

    // Uso pessoal
    inputUsoPessoal: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      padding: 10,
      color: tema.texto,
      fontSize: 12,
      minHeight: 60,
      marginTop: 8,
    },

    // Auditoria
    blocoAuditoriaInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    iconeEscudo: {
      fontSize: 14,
    },
    textoAuditoria: {
      fontSize: 11,
      color: tema.textoTerciario,
      flex: 1,
    },
    destaqueAuditoria: {
      fontWeight: '700',
      color: tema.textoSecundario,
    },

    // Rodapé de Ações com Hierarquia Clara
    rodape: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    botaoExcluir: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: '#ef444415',
      borderWidth: 1,
      borderColor: '#ef444430',
    },
    textoBotaoExcluir: {
      color: '#dc2626',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    grupoNavRodape: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      paddingHorizontal: 8,
      minHeight: 44,
    },
    botaoNavRodape: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoNavRodape: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.texto,
    },
    textoContadorRodape: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.textoSecundario,
      paddingHorizontal: 4,
    },
    botaoFechar: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoFechar: {
      color: tema.texto,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    botaoEditar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: '#2563eb',
      shadowColor: '#2563eb',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    iconeBotaoEditar: {
      fontSize: 12,
    },
    textoBotaoEditar: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    grupoHeroDireita: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    badgeSeiHero: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tema.primariaFundo,
      borderWidth: 1,
      borderColor: tema.primaria,
    },
    textoBadgeSeiHero: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.primariaTexto,
    },
    badgeEtapaKanban: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: tema.primariaFundo,
      borderWidth: 1,
      borderColor: tema.primaria,
    },
    textoBadgeEtapaKanban: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.primariaTexto,
      textTransform: 'uppercase',
    },
    blocoResumoKanban: {
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoIndiceKanban: {
      fontSize: 12,
      fontWeight: '700',
      color: tema.texto,
    },
    faixaFatoresDetalhe: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tagFatorDetalhe: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: tema.erroFundo,
    },
    textoTagFatorDetalhe: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.erro,
    },
    textoSemFatoresDetalhe: {
      fontSize: 12,
      color: tema.sucesso,
      fontWeight: '600',
    },
    textoContinuidadeDetalhe: {
      fontSize: 12,
      fontWeight: '700',
      color: tema.alerta,
    },
    listaPareceresKanban: {
      marginTop: 10,
      gap: 8,
    },
    itemParecerKanban: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      gap: 4,
    },
    linhaTopoParecerKanban: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    decisaoParecerKanban: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.primariaTexto,
      textTransform: 'uppercase',
    },
    seiParecerKanban: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.primaria,
    },
    continuidadeParecerKanban: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.alerta,
    },
    faixaAcoesKanban: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    botaoParecerDetalhe: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tema.primaria,
    },
    textoBotaoParecerDetalhe: {
      fontSize: 12,
      fontWeight: '700',
      color: tema.textoInvertido,
    },
    botaoAutoKanban: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoAutoKanban: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.textoSecundario,
    },
    badgeSeiComentario: {
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tema.primariaFundo,
      borderWidth: 1,
      borderColor: tema.primaria,
      marginBottom: 4,
    },
    textoBadgeSeiComentario: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.primariaTexto,
    },
    inputSeiComentario: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: tema.texto,
      fontSize: 12,
      marginBottom: 8,
    },
  });
};

export default DetalheRegistro;
