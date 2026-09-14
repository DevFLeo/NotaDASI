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
import { registroEmBranco, type NovoRegistro } from '../data/registros';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';

type Props = {
  visivel: boolean;
  tituloModal: string;
  valorInicial?: NovoRegistro;
  aoSalvar: (dados: NovoRegistro) => void;
  aoCancelar: () => void;
  aoExcluir?: () => void;
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
 * Formulario unico de criacao e edicao de uma competencia.
 *
 * Usado tanto a partir da Lista (criar do zero) quanto do Mapa Mental
 * (criar uma nova secretaria/setor é, na pratica, criar a primeira
 * competencia dela — os setores nao existem como entidade separada, sao
 * derivados dos registros em mapa/layout.ts).
 */
const FormularioRegistro: React.FC<Props> = ({
  visivel,
  tituloModal,
  valorInicial,
  aoSalvar,
  aoCancelar,
  aoExcluir,
}) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { gesto, estiloArrasto, deslocY } = useArrastarParaFechar(aoCancelar);
  const [dados, setDados] = useState<NovoRegistro>(() => valorInicial ?? registroEmBranco());

  // O componente nao desmonta entre aberturas (so o Modal alterna `visible`) —
  // sem isto, reabrir o formulario apos um arrasto-para-fechar o traria de
  // volta ja deslocado para baixo.
  useEffect(() => {
    if (visivel) {
      deslocY.value = 0;
    }
  }, [visivel, deslocY]);

  // Reinicia o formulario sempre que ele for reaberto com um valor diferente.
  const [ultimoValorInicial, setUltimoValorInicial] = useState(valorInicial);
  if (valorInicial !== ultimoValorInicial) {
    setUltimoValorInicial(valorInicial);
    setDados(valorInicial ?? registroEmBranco());
  }

  const definirCampo = <C extends keyof NovoRegistro>(campo: C, valor: NovoRegistro[C]) => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  };

  const definirContato = (
    tipo: 'contatoInstitucional' | 'contatoPessoal',
    campo: 'email' | 'telefone' | 'ramal',
    valor: string,
  ) => {
    setDados((atual) => ({
      ...atual,
      [tipo]: { ...atual[tipo], [campo]: valor },
    }));
  };

  const confirmarSalvar = () => {
    if (!dados.setor.trim() && !dados.setorSigla.trim()) {
      Alert.alert('Falta o setor', 'Informe pelo menos o nome ou a sigla do setor/secretaria.');
      return;
    }
    if (!dados.competencia.trim()) {
      Alert.alert('Falta a competência', 'Descreva a competência avaliada.');
      return;
    }
    aoSalvar(dados);
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoCancelar}>
      {/* O Modal do RN abre numa janela nativa separada, fora da árvore do
          GestureHandlerRootView principal — sem este wrapper próprio, o
          gesto de arrastar a alça fica sem efeito dentro do modal. */}
      <GestureHandlerRootView style={estilos.fundo}>
        {/* O Modal do RN abre como um Dialog nativo no Android, que nao
            herda o adjustResize da Activity — sem isto o teclado cobre o
            rodape (Cancelar/Salvar/Excluir) quando o campo focado esta
            mais abaixo no formulario. */}
        <Animated.View style={estiloArrasto}>
        <KeyboardAvoidingView
          style={estilos.painel}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <GestureDetector gesture={gesto}>
            <View style={estilos.areaPuxador}>
              <View style={estilos.puxador} />
            </View>
          </GestureDetector>
          <Text style={estilos.titulo}>{tituloModal}</Text>

          <ScrollView
            style={estilos.scroll}
            contentContainerStyle={estilos.conteudo}
            showsVerticalScrollIndicator={false}>
            <Secao tema={tema} titulo="Lotação" />
            <CampoTexto tema={tema} rotulo="Departamento" valor={dados.departamento} aoAlterar={(v) => definirCampo('departamento', v)} />
            <CampoTexto tema={tema} rotulo="Sigla do departamento" valor={dados.departamentoSigla} aoAlterar={(v) => definirCampo('departamentoSigla', v)} />
            <CampoTexto tema={tema} rotulo="Diretor(a) responsável" valor={dados.departamentoResponsavel} aoAlterar={(v) => definirCampo('departamentoResponsavel', v)} />
            <CampoTexto tema={tema} rotulo="Cargo do diretor(a)" valor={dados.departamentoCargo} aoAlterar={(v) => definirCampo('departamentoCargo', v)} />
            <CampoTexto tema={tema} rotulo="Setor / secretaria *" valor={dados.setor} aoAlterar={(v) => definirCampo('setor', v)} />
            <CampoTexto tema={tema} rotulo="Sigla do setor" valor={dados.setorSigla} aoAlterar={(v) => definirCampo('setorSigla', v)} />
            <CampoTexto tema={tema} rotulo="Responsável pelo setor" valor={dados.responsavel} aoAlterar={(v) => definirCampo('responsavel', v)} />
            <CampoTexto tema={tema} rotulo="Cargo do responsável" valor={dados.cargo} aoAlterar={(v) => definirCampo('cargo', v)} />

            <Secao tema={tema} titulo="Competência avaliada" />
            <CampoTexto
              tema={tema}
              rotulo="Descrição da competência *"
              valor={dados.competencia}
              aoAlterar={(v) => definirCampo('competencia', v)}
              multilinha
            />

            <Secao tema={tema} titulo="Atendimento pelo SIG" />
            <CampoBooleano
              tema={tema}
              rotulo="O sistema atende?"
              valor={dados.sistemaAtende}
              aoAlterar={(v) => definirCampo('sistemaAtende', v)}
            />
            <CampoTexto tema={tema} rotulo="De que forma" valor={dados.comoAtende} aoAlterar={(v) => definirCampo('comoAtende', v)} multilinha />
            <CampoBooleano
              tema={tema}
              rotulo="Já estruturado no sistema?"
              valor={dados.estruturadoNoSistema}
              aoAlterar={(v) => definirCampo('estruturadoNoSistema', v)}
            />
            <CampoBooleano
              tema={tema}
              rotulo="Houve treinamento?"
              valor={dados.houveTreinamento}
              aoAlterar={(v) => definirCampo('houveTreinamento', v)}
            />

            <Secao tema={tema} titulo="Camadas" />
            <CampoTexto tema={tema} rotulo="Informações acessadas" valor={dados.informacoesAcessadas} aoAlterar={(v) => definirCampo('informacoesAcessadas', v)} />
            <CampoTexto tema={tema} rotulo="Nível de acesso à camada" valor={dados.nivelAcessoCamada} aoAlterar={(v) => definirCampo('nivelAcessoCamada', v)} />
            <CampoBooleano
              tema={tema}
              rotulo="Acesso à camada concedido?"
              valor={dados.acessoCamadaConcedido}
              aoAlterar={(v) => definirCampo('acessoCamadaConcedido', v)}
            />
            <CampoBooleano
              tema={tema}
              rotulo="Já iniciou a atividade?"
              valor={dados.iniciouAtividade}
              aoAlterar={(v) => definirCampo('iniciouAtividade', v)}
            />

            <Secao tema={tema} titulo="Módulo" />
            <CampoTexto tema={tema} rotulo="Módulo do SIG" valor={dados.moduloSig} aoAlterar={(v) => definirCampo('moduloSig', v)} />
            <CampoTexto tema={tema} rotulo="Nível de acesso ao módulo" valor={dados.nivelAcessoModulo} aoAlterar={(v) => definirCampo('nivelAcessoModulo', v)} />
            <CampoBooleano
              tema={tema}
              rotulo="Acesso ao módulo concedido?"
              valor={dados.acessoModuloConcedido}
              aoAlterar={(v) => definirCampo('acessoModuloConcedido', v)}
            />

            <Secao tema={tema} titulo="Problemas" />
            <CampoBooleano tema={tema} rotulo="Tem problema no SIG?" valor={dados.temProblema} aoAlterar={(v) => definirCampo('temProblema', v)} />
            <CampoBooleano tema={tema} rotulo="Tem chamado aberto?" valor={dados.temChamado} aoAlterar={(v) => definirCampo('temChamado', v)} />
            <CampoTexto tema={tema} rotulo="Detalhe do problema" valor={dados.detalheProblema} aoAlterar={(v) => definirCampo('detalheProblema', v)} multilinha />
            <CampoTexto tema={tema} rotulo="Observação" valor={dados.observacao} aoAlterar={(v) => definirCampo('observacao', v)} multilinha />

            <Secao tema={tema} titulo="Contato institucional" />
            <CampoTexto tema={tema} rotulo="E-mail" valor={dados.contatoInstitucional?.email ?? ''} aoAlterar={(v) => definirContato('contatoInstitucional', 'email', v)} />
            <CampoTexto tema={tema} rotulo="Telefone" valor={dados.contatoInstitucional?.telefone ?? ''} aoAlterar={(v) => definirContato('contatoInstitucional', 'telefone', v)} />
            <CampoTexto tema={tema} rotulo="Ramal" valor={dados.contatoInstitucional?.ramal ?? ''} aoAlterar={(v) => definirContato('contatoInstitucional', 'ramal', v)} />

            <Secao tema={tema} titulo="Contato pessoal (protegido)" />
            <CampoTexto tema={tema} rotulo="E-mail" valor={dados.contatoPessoal?.email ?? ''} aoAlterar={(v) => definirContato('contatoPessoal', 'email', v)} />
            <CampoTexto tema={tema} rotulo="Telefone" valor={dados.contatoPessoal?.telefone ?? ''} aoAlterar={(v) => definirContato('contatoPessoal', 'telefone', v)} />
          </ScrollView>

          <View style={estilos.rodape}>
            {aoExcluir ? (
              <Pressable onPress={aoExcluir} style={estilos.botaoExcluir}>
                <Text style={estilos.textoBotaoExcluir}>Excluir</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={aoCancelar} style={estilos.botaoCancelar}>
              <Text style={estilos.textoBotaoCancelar}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirmarSalvar} style={estilos.botaoSalvar}>
              <Text style={estilos.textoBotaoSalvar}>Salvar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const Secao: React.FC<{ tema: Tema; titulo: string }> = ({ tema, titulo }) => {
  const estilos = criarEstilos(tema);
  return <Text style={estilos.secao}>{titulo}</Text>;
};

const CampoTexto: React.FC<{
  tema: Tema;
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  multilinha?: boolean;
}> = ({ tema, rotulo, valor, aoAlterar, multilinha }) => {
  const estilos = criarEstilos(tema);
  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={aoAlterar}
        style={[estilos.input, multilinha && estilos.inputMultilinha]}
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
}> = ({ tema, rotulo, valor, aoAlterar }) => {
  const estilos = criarEstilos(tema);
  return (
    <View style={[estilos.bloco, estilos.blocoBooleano]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Pressable
        onPress={() => aoAlterar(proximoValorBooleano(valor))}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${rotuloBooleano(valor)}. Toque para alterar.`}
        style={[
          estilos.chipBooleano,
          valor === true && estilos.chipBooleanoSim,
          valor === false && estilos.chipBooleanoNao,
        ]}>
        <Text style={estilos.textoChipBooleano}>{rotuloBooleano(valor)}</Text>
      </Pressable>
    </View>
  );
};

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: tema.overlay },
    painel: {
      maxHeight: '92%',
      backgroundColor: tema.fundoElevado,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 22,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: tema.borda,
    },
    areaPuxador: {
      alignItems: 'center',
      paddingVertical: 8,
      marginBottom: 6,
    },
    puxador: {
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: tema.bordaForte,
    },
    titulo: { color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    scroll: { flexShrink: 1 },
    conteudo: { paddingBottom: 12 },
    secao: {
      color: tema.primaria,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: 18,
      marginBottom: 4,
    },
    bloco: { marginTop: 10 },
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
    rodape: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
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
      flex: 1,
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

export default FormularioRegistro;
