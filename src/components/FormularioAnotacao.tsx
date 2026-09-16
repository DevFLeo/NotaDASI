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
import { requisitosFaltando, type Anotacao, type Campo, type RequisitoCampo } from '../data/campos';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';

type Valores = Anotacao['valores'];

type Props = {
  visivel: boolean;
  campo: Campo;
  /** Anotação em edição; `null` cria uma nova. */
  anotacao: Anotacao | null;
  aoSalvar: (valores: Valores) => void;
  aoCancelar: () => void;
  aoExcluir?: () => void;
};

/** Cicla entre não-respondido → Sim → Não → não-respondido, como no formulário do SIG. */
const proximoBooleano = (atual?: string | boolean): boolean | undefined => {
  if (atual === undefined || atual === '') return true;
  if (atual === true) return false;
  return undefined;
};

/**
 * Formulário de um item de campo livre.
 *
 * Diferente do FormularioRegistro, aqui nada é fixo: os campos saem do
 * `campo.formulario`, que o próprio usuário definiu ao criar o cofre. Por isso
 * os valores são um mapa `idDoRequisito → valor`, e não um objeto tipado.
 */
const FormularioAnotacao: React.FC<Props> = ({
  visivel,
  campo,
  anotacao,
  aoSalvar,
  aoCancelar,
  aoExcluir,
}) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { gesto, estiloArrasto, deslocY } = useArrastarParaFechar(aoCancelar);
  const [valores, setValores] = useState<Valores>(() => anotacao?.valores ?? {});

  useEffect(() => {
    if (visivel) {
      deslocY.value = 0;
    }
  }, [visivel, deslocY]);

  // Recarrega quando o modal é reaberto com outro item (ele não desmonta entre
  // aberturas — só alterna `visible`).
  const [ultimaAnotacao, setUltimaAnotacao] = useState(anotacao);
  if (anotacao !== ultimaAnotacao) {
    setUltimaAnotacao(anotacao);
    setValores(anotacao?.valores ?? {});
  }

  const definir = (id: string, valor: string | boolean | undefined) => {
    setValores((atual) => ({ ...atual, [id]: valor }));
  };

  const confirmar = () => {
    const faltando = requisitosFaltando(campo, valores);
    if (faltando.length > 0) {
      Alert.alert(
        'Falta preencher',
        `Este campo exige: ${faltando.map((requisito) => requisito.rotulo).join(', ')}.`,
      );
      return;
    }
    aoSalvar(valores);
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoCancelar}>
      <GestureHandlerRootView style={estilos.fundo}>
        <Animated.View style={estiloArrasto}>
          <KeyboardAvoidingView
            style={estilos.painel}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <GestureDetector gesture={gesto}>
              <View style={estilos.areaPuxador}>
                <View style={estilos.puxador} />
              </View>
            </GestureDetector>

            <Text style={estilos.titulo}>
              {anotacao ? 'Editar item' : `Novo item em ${campo.nome}`}
            </Text>

            <ScrollView
              style={estilos.scroll}
              contentContainerStyle={estilos.conteudo}
              showsVerticalScrollIndicator={false}>
              {campo.formulario.map((requisito) => (
                <CampoDinamico
                  key={requisito.id}
                  tema={tema}
                  requisito={requisito}
                  valor={valores[requisito.id]}
                  aoAlterar={(valor) => definir(requisito.id, valor)}
                />
              ))}

              {campo.formulario.length === 0 ? (
                <Text style={estilos.vazio}>
                  Este campo ainda não tem nenhuma pergunta no cadastro. Segure a aba Lista, abra o
                  menu de campos e edite o formulário dele.
                </Text>
              ) : null}
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
              <Pressable onPress={confirmar} style={estilos.botaoSalvar}>
                <Text style={estilos.textoBotaoSalvar}>Salvar</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const CampoDinamico: React.FC<{
  tema: Tema;
  requisito: RequisitoCampo;
  valor: string | boolean | undefined;
  aoAlterar: (valor: string | boolean | undefined) => void;
}> = ({ tema, requisito, valor, aoAlterar }) => {
  const estilos = criarEstilos(tema);
  const rotulo = `${requisito.rotulo}${requisito.obrigatorio ? ' *' : ''}`;

  if (requisito.tipo === 'sim-nao') {
    const texto = valor === true ? 'Sim' : valor === false ? 'Não' : '—';
    return (
      <View style={[estilos.bloco, estilos.blocoBooleano]}>
        <Text style={estilos.rotuloEmLinha}>{rotulo}</Text>
        <Pressable
          onPress={() => aoAlterar(proximoBooleano(valor))}
          accessibilityRole="button"
          accessibilityLabel={`${requisito.rotulo}: ${texto}`}
          style={[
            estilos.chipBooleano,
            valor === true && estilos.chipBooleanoSim,
            valor === false && estilos.chipBooleanoNao,
          ]}>
          <Text style={estilos.textoChipBooleano}>{texto}</Text>
        </Pressable>
      </View>
    );
  }

  const multilinha = requisito.tipo === 'texto-longo';

  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        value={typeof valor === 'string' ? valor : ''}
        onChangeText={aoAlterar}
        style={[estilos.input, multilinha && estilos.inputMultilinha]}
        placeholder={requisito.tipo === 'data' ? 'DD/MM/AAAA' : '—'}
        placeholderTextColor={tema.textoTerciario}
        multiline={multilinha}
        keyboardType={requisito.tipo === 'numero' ? 'numeric' : 'default'}
      />
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
    areaPuxador: { alignItems: 'center', paddingVertical: 8, marginBottom: 6 },
    puxador: { width: 40, height: 4, borderRadius: 999, backgroundColor: tema.bordaForte },
    titulo: { color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    scroll: { flexShrink: 1 },
    conteudo: { paddingBottom: 12 },
    vazio: { color: tema.textoSecundario, fontSize: 13, lineHeight: 19, marginTop: 16 },
    bloco: { marginTop: 12 },
    blocoBooleano: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rotulo: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    rotuloEmLinha: {
      flex: 1,
      color: tema.texto,
      fontSize: 13,
      fontWeight: '600',
      paddingRight: 10,
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
    inputMultilinha: { minHeight: 90, textAlignVertical: 'top' },
    chipBooleano: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    chipBooleanoSim: { backgroundColor: tema.sucessoFundo, borderColor: tema.sucesso },
    chipBooleanoNao: { backgroundColor: tema.erroFundo, borderColor: tema.erro },
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

export default FormularioAnotacao;
