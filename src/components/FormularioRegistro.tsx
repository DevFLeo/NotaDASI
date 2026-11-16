import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { useSessao } from '../auth/useSessao';
import { registroEmBranco, type NovoRegistro } from '../data/registros';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';

type Props = {
  visivel: boolean;
  tituloModal: string;
  valorInicial?: NovoRegistro;
  aoSalvar: (dados: NovoRegistro) => void;
  aoCancelar: () => void;
  aoExcluir?: () => void;
  aoAdicionarComentario?: (texto: string) => void;
};

/** Cicla entre nao-respondido → Sim → Nao → nao-respondido, a cada toque. */
const proximoValorBooleano = (atual?: boolean): boolean | undefined => {
  if (atual === undefined) return true;
  if (atual === true) return false;
  return undefined;
};

const rotuloBooleano = (valor?: boolean): string =>
  valor === true ? 'Sim' : valor === false ? 'Não' : '—';

/**
 * Formulário único de criação e edição de uma competência.
 *
 * Atualizado para:
 * - Modo PC: Centralizado, grade em 2 colunas, rolagem por mouse wheel perfeita.
 * - Modo Celular: Arraste para cima para TELA CHEIA (100%), botão ⤢ / 🗕.
 * - Regras de Governança: DASI pode editar tudo; Chefe DGEO visualiza e comenta; Secretaria audita.
 */
const FormularioRegistro: React.FC<Props> = ({
  visivel,
  tituloModal,
  valorInicial,
  aoSalvar,
  aoCancelar,
  aoExcluir,
  aoAdicionarComentario,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const { contaAtual } = useSessao();
  const { gesto, estiloArrasto, deslocY, telaCheia, alternarTelaCheia } = useArrastarParaFechar(aoCancelar);

  const [dados, setDados] = useState<NovoRegistro>(() => valorInicial ?? registroEmBranco());
  const [novoComentario, setNovoComentario] = useState('');

  // Perfil Chefe do DGEO em registro existente não pode sobrescrever tabelas do DASI
  const eChefeDgeo = contaAtual?.papel === 'gerente';
  const eSecretaria = contaAtual?.papel === 'secretario';
  const eDasi = contaAtual?.papel === 'dasi' || (!eChefeDgeo && !eSecretaria);
  const edicaoBloqueada = eChefeDgeo && tituloModal.includes('Editar');

  useEffect(() => {
    if (visivel) {
      deslocY.value = 0;
    }
  }, [visivel, deslocY]);

  const [ultimoValorInicial, setUltimoValorInicial] = useState(valorInicial);
  if (valorInicial !== ultimoValorInicial) {
    setUltimoValorInicial(valorInicial);
    setDados(valorInicial ?? registroEmBranco());
  }

  const definirCampo = <C extends keyof NovoRegistro>(campo: C, valor: NovoRegistro[C]) => {
    if (edicaoBloqueada) return;
    setDados((atual) => ({ ...atual, [campo]: valor }));
  };

  const definirContato = (
    tipo: 'contatoInstitucional' | 'contatoPessoal',
    campo: 'email' | 'telefone' | 'ramal',
    valor: string,
  ) => {
    if (edicaoBloqueada) return;
    setDados((atual) => ({
      ...atual,
      [tipo]: { ...atual[tipo], [campo]: valor },
    }));
  };

  const confirmarSalvar = () => {
    if (edicaoBloqueada) {
      if (novoComentario.trim() && aoAdicionarComentario) {
        aoAdicionarComentario(novoComentario.trim());
        setNovoComentario('');
        aoCancelar();
      } else {
        Alert.alert(
          'Apenas comentários permitidos',
          'O perfil Chefe do DGEO pode declarar comentários às tabelas do DASI, mas a edição direta é reservada ao DASI.',
        );
      }
      return;
    }

    if (!dados.setor.trim() && !dados.setorSigla.trim()) {
      Alert.alert('Falta o setor', 'Informe pelo menos o nome ou a sigla do setor/secretaria.');
      return;
    }
    if (!dados.competencia.trim()) {
      Alert.alert('Falta a competência', 'Descreva a competência avaliada.');
      return;
    }

    // Carimbo de auditoria se DASI estiver salvando
    const dadosComAuditoria = {
      ...dados,
      atualizadoPor: contaAtual
        ? { usuario: contaAtual.usuario, nome: contaAtual.nome, papel: contaAtual.papel }
        : undefined,
      atualizadoEm: new Date().toISOString(),
    };

    aoSalvar(dadosComAuditoria);
  };

  const estilos = criarEstilos(tema, metricas, telaCheia);

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoCancelar}>
      <GestureHandlerRootView style={estilos.fundo}>
        <Animated.View style={[estilos.wrapperAnimado, estiloArrasto]}>
          <KeyboardAvoidingView
            style={estilos.painel}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Puxador de gesto (arraste para cima = tela cheia, arraste para baixo = fechar) */}
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
              <View style={estilos.titulos}>
                <Text style={estilos.titulo}>{tituloModal}</Text>
                {edicaoBloqueada ? (
                  <Text style={estilos.seloAviso}>
                    Modo Leitura e Comentário (Chefe DGEO) · Tabelas prioritárias do DASI
                  </Text>
                ) : null}
              </View>

              <View style={estilos.botoesTopo}>
                <Pressable
                  onPress={alternarTelaCheia}
                  accessibilityRole="button"
                  accessibilityLabel={telaCheia ? 'Restaurar altura' : 'Tela cheia'}
                  style={estilos.botaoTopo}>
                  <Text style={estilos.textoBotaoTopo}>{telaCheia ? '🗕' : '⤢'}</Text>
                </Pressable>
                <Pressable
                  onPress={aoCancelar}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar formulário"
                  style={estilos.botaoTopo}>
                  <Text style={estilos.textoBotaoTopo}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Conteúdo rolável com flex e overflow-y auto para garantir scroll no PC e Mobile */}
            <ScrollView
              style={estilos.scroll}
              contentContainerStyle={estilos.conteudo}
              showsVerticalScrollIndicator>
              
              <Secao tema={tema} titulo="1. Lotação & Secretaria" />
              <View style={estilos.grade}>
                <CampoTexto
                  tema={tema}
                  rotulo="Secretaria / Departamento"
                  valor={dados.departamento}
                  aoAlterar={(v) => definirCampo('departamento', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Sigla do departamento"
                  valor={dados.departamentoSigla}
                  aoAlterar={(v) => definirCampo('departamentoSigla', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Diretor(a) responsável"
                  valor={dados.departamentoResponsavel}
                  aoAlterar={(v) => definirCampo('departamentoResponsavel', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Cargo do diretor(a)"
                  valor={dados.departamentoCargo}
                  aoAlterar={(v) => definirCampo('departamentoCargo', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Setor / Divisão *"
                  valor={dados.setor}
                  aoAlterar={(v) => definirCampo('setor', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Sigla do setor"
                  valor={dados.setorSigla}
                  aoAlterar={(v) => definirCampo('setorSigla', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Responsável pelo setor"
                  valor={dados.responsavel}
                  aoAlterar={(v) => definirCampo('responsavel', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Cargo do responsável"
                  valor={dados.cargo}
                  aoAlterar={(v) => definirCampo('cargo', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>

              <Secao tema={tema} titulo="2. Competência Avaliada" />
              <CampoTexto
                tema={tema}
                rotulo="Descrição da competência *"
                valor={dados.competencia}
                aoAlterar={(v) => definirCampo('competencia', v)}
                multilinha
                desabilitado={edicaoBloqueada}
              />

              <Secao tema={tema} titulo="3. Atendimento pelo SIG" />
              <View style={estilos.grade}>
                <CampoBooleano
                  tema={tema}
                  rotulo="O sistema atende?"
                  valor={dados.sistemaAtende}
                  aoAlterar={(v) => definirCampo('sistemaAtende', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Já estruturado no sistema?"
                  valor={dados.estruturadoNoSistema}
                  aoAlterar={(v) => definirCampo('estruturadoNoSistema', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Houve treinamento?"
                  valor={dados.houveTreinamento}
                  aoAlterar={(v) => definirCampo('houveTreinamento', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>
              <CampoTexto
                tema={tema}
                rotulo="De que forma o SIG atende"
                valor={dados.comoAtende}
                aoAlterar={(v) => definirCampo('comoAtende', v)}
                multilinha
                desabilitado={edicaoBloqueada}
              />

              <Secao tema={tema} titulo="4. Camadas do SIG" />
              <View style={estilos.grade}>
                <CampoTexto
                  tema={tema}
                  rotulo="Informações acessadas"
                  valor={dados.informacoesAcessadas}
                  aoAlterar={(v) => definirCampo('informacoesAcessadas', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Nível de acesso à camada"
                  valor={dados.nivelAcessoCamada}
                  aoAlterar={(v) => definirCampo('nivelAcessoCamada', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Acesso à camada concedido?"
                  valor={dados.acessoCamadaConcedido}
                  aoAlterar={(v) => definirCampo('acessoCamadaConcedido', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Já iniciou a atividade?"
                  valor={dados.iniciouAtividade}
                  aoAlterar={(v) => definirCampo('iniciouAtividade', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>

              <Secao tema={tema} titulo="5. Módulo do SIG" />
              <View style={estilos.grade}>
                <CampoTexto
                  tema={tema}
                  rotulo="Módulo do SIG"
                  valor={dados.moduloSig}
                  aoAlterar={(v) => definirCampo('moduloSig', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Nível de acesso ao módulo"
                  valor={dados.nivelAcessoModulo}
                  aoAlterar={(v) => definirCampo('nivelAcessoModulo', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Acesso ao módulo concedido?"
                  valor={dados.acessoModuloConcedido}
                  aoAlterar={(v) => definirCampo('acessoModuloConcedido', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>

              <Secao tema={tema} titulo="6. Problemas & Chamados Técnicos" />
              <View style={estilos.grade}>
                <CampoBooleano
                  tema={tema}
                  rotulo="Tem problema no SIG?"
                  valor={dados.temProblema}
                  aoAlterar={(v) => definirCampo('temProblema', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoBooleano
                  tema={tema}
                  rotulo="Tem chamado aberto?"
                  valor={dados.temChamado}
                  aoAlterar={(v) => definirCampo('temChamado', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>
              <CampoTexto
                tema={tema}
                rotulo="Detalhe do problema"
                valor={dados.detalheProblema}
                aoAlterar={(v) => definirCampo('detalheProblema', v)}
                multilinha
                desabilitado={edicaoBloqueada}
              />
              <CampoTexto
                tema={tema}
                rotulo="Observação geral"
                valor={dados.observacao}
                aoAlterar={(v) => definirCampo('observacao', v)}
                multilinha
                desabilitado={edicaoBloqueada}
              />

              <Secao tema={tema} titulo="7. Contatos para Adesão" />
              <View style={estilos.grade}>
                <CampoTexto
                  tema={tema}
                  rotulo="E-mail Institucional"
                  valor={dados.contatoInstitucional?.email ?? ''}
                  aoAlterar={(v) => definirContato('contatoInstitucional', 'email', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Telefone Institucional"
                  valor={dados.contatoInstitucional?.telefone ?? ''}
                  aoAlterar={(v) => definirContato('contatoInstitucional', 'telefone', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Ramal Institucional"
                  valor={dados.contatoInstitucional?.ramal ?? ''}
                  aoAlterar={(v) => definirContato('contatoInstitucional', 'ramal', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>

              <Secao tema={tema} titulo="Contato pessoal (protegido)" />
              <View style={estilos.grade}>
                <CampoTexto
                  tema={tema}
                  rotulo="E-mail Pessoal"
                  valor={dados.contatoPessoal?.email ?? ''}
                  aoAlterar={(v) => definirContato('contatoPessoal', 'email', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
                <CampoTexto
                  tema={tema}
                  rotulo="Telefone Pessoal"
                  valor={dados.contatoPessoal?.telefone ?? ''}
                  aoAlterar={(v) => definirContato('contatoPessoal', 'telefone', v)}
                  desabilitado={edicaoBloqueada}
                  colunaDupla={metricas.expandida}
                />
              </View>

              {/* Se for Chefe do DGEO ou Secretaria, área para comentários */}
              {(eChefeDgeo || eSecretaria) && (
                <View style={estilos.blocoComentario}>
                  <Secao tema={tema} titulo="Comentário / Despacho Oficial" />
                  <TextInput
                    value={novoComentario}
                    onChangeText={setNovoComentario}
                    placeholder="Adicionar parecer técnico ou despacho para o DASI..."
                    placeholderTextColor={tema.textoTerciario}
                    multiline
                    style={[estilos.input, estilos.inputMultilinha]}
                  />
                </View>
              )}
            </ScrollView>

            {/* Rodapé de ações */}
            <View style={estilos.rodape}>
              {aoExcluir && !edicaoBloqueada ? (
                <Pressable onPress={aoExcluir} style={estilos.botaoExcluir}>
                  <Text style={estilos.textoBotaoExcluir}>Excluir</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={aoCancelar} style={estilos.botaoCancelar}>
                <Text style={estilos.textoBotaoCancelar}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmarSalvar} style={estilos.botaoSalvar}>
                <Text style={estilos.textoBotaoSalvar}>
                  {edicaoBloqueada ? 'Declarar Comentário' : 'Salvar'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const Secao: React.FC<{ tema: Tema; titulo: string }> = ({ tema, titulo }) => {
  const estilos = criarEstilosBase(tema);
  return <Text style={estilos.secao}>{titulo}</Text>;
};

const CampoTexto: React.FC<{
  tema: Tema;
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  multilinha?: boolean;
  desabilitado?: boolean;
  colunaDupla?: boolean;
}> = ({ tema, rotulo, valor, aoAlterar, multilinha, desabilitado, colunaDupla }) => {
  const estilos = criarEstilosBase(tema);
  return (
    <View style={[estilos.bloco, colunaDupla && estilos.blocoColunaDupla]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={aoAlterar}
        editable={!desabilitado}
        style={[
          estilos.input,
          multilinha && estilos.inputMultilinha,
          desabilitado && estilos.inputDesabilitado,
        ]}
        placeholder="—"
        placeholderTextColor={tema.textoTerciario}
        multiline={multilinha}
      />
    </View>
  );
};

const CampoBooleano: React.FC<{
  tema: Tema;
  rotulo: string;
  valor?: boolean;
  aoAlterar: (valor?: boolean) => void;
  desabilitado?: boolean;
  colunaDupla?: boolean;
}> = ({ tema, rotulo, valor, aoAlterar, desabilitado, colunaDupla }) => {
  const estilos = criarEstilosBase(tema);
  return (
    <View
      style={[
        estilos.bloco,
        estilos.blocoBooleano,
        colunaDupla && estilos.blocoColunaDupla,
      ]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Pressable
        disabled={desabilitado}
        onPress={() => aoAlterar(proximoValorBooleano(valor))}
        style={[
          estilos.chipBooleano,
          valor === true && estilos.chipBooleanoSim,
          valor === false && estilos.chipBooleanoNao,
          desabilitado && { opacity: 0.6 },
        ]}>
        <Text style={estilos.textoChipBooleano}>{rotuloBooleano(valor)}</Text>
      </Pressable>
    </View>
  );
};

const criarEstilosBase = (tema: Tema) =>
  StyleSheet.create({
    secao: {
      color: tema.primaria,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: 20,
      marginBottom: 6,
      width: '100%',
    },
    bloco: { marginTop: 10, width: '100%' },
    blocoColunaDupla: { width: '48.5%' },
    blocoBooleano: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rotulo: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    input: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tema.texto,
      fontSize: 14,
    },
    inputMultilinha: {
      minHeight: 70,
      textAlignVertical: 'top',
    },
    inputDesabilitado: {
      backgroundColor: tema.fundo,
      borderColor: tema.borda,
      color: tema.textoSecundario,
    },
    chipBooleano: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    chipBooleanoSim: {
      backgroundColor: tema.sucessoFundo,
      borderColor: tema.sucesso,
    },
    chipBooleanoNao: {
      backgroundColor: tema.erroFundo,
      borderColor: tema.erro,
    },
    textoChipBooleano: { color: tema.texto, fontSize: 12, fontWeight: '700' },
  });

const criarEstilos = (tema: Tema, metricas: ReturnType<typeof useMetricas>, telaCheia: boolean) => {
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
      maxWidth: ePC ? 800 : undefined,
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
    titulos: { flex: 1, minWidth: 0 },
    titulo: { color: tema.texto, fontSize: 18, fontWeight: '700' },
    seloAviso: {
      color: tema.primaria,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },
    botoesTopo: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    botaoTopo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoTopo: { color: tema.textoSecundario, fontSize: 14, fontWeight: '700' },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    conteudo: {
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    grade: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    blocoComentario: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tema.primaria,
      backgroundColor: tema.primariaFundo,
    },
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: tema.erroFundo,
    },
    textoBotaoExcluir: { color: tema.erro, fontSize: 13, fontWeight: '700' },
    botaoCancelar: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: tema.superficie,
    },
    textoBotaoCancelar: { color: tema.textoSecundario, fontSize: 13, fontWeight: '700' },
    botaoSalvar: {
      flex: 1.4,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: tema.primaria,
    },
    textoBotaoSalvar: {
      color: tema.textoInvertido,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
  });
};

export default FormularioRegistro;
