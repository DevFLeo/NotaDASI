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
import {
  ROTULO_TIPO,
  formularioPadrao,
  gerarIdRequisito,
  type Campo,
  type RequisitoCampo,
  type TipoDeDado,
} from '../data/campos';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import { IconeX } from '../tema/Icones';

type Props = {
  visivel: boolean;
  campos: Campo[];
  campoAtivo: Campo;
  contarItens: (campo: Campo) => number;
  aoFechar: () => void;
  aoTrocar: (id: string) => void;
  aoCriar: (nome: string, formulario: RequisitoCampo[]) => void;
  aoAtualizar: (id: string, nome: string, formulario: RequisitoCampo[]) => void;
  aoExcluir: (id: string) => void;
  /**
   * No PC este menu não é uma folha que sobe: ele é o painel fixo de 35% ao
   * lado do mapa (ver pc/CascaPC.tsx). Com `embutido`, o mesmo componente
   * desenha sem Modal, sem alça de arrastar e ocupando o espaço do pai.
   * Falso por padrão — o Android continua exatamente como era.
   */
  embutido?: boolean;
};

type Edicao = { modo: 'criar' } | { modo: 'editar'; campo: Campo } | null;

const TIPOS: TipoDeDado[] = ['texto', 'texto-longo', 'numero', 'sim-nao', 'data'];

/**
 * Menu dos campos (cofres), aberto ao SEGURAR a aba Lista ou Mapa mental na
 * barra de baixo (e pelo botão em Ajustes → Campos).
 *
 * Faz as duas coisas que interessam nesse momento: trocar de campo e criar um
 * campo novo. Criar é onde se define o formulário do cofre — quais perguntas o
 * cadastro dele vai ter — porque um campo livre não herda nada do levantamento
 * do SIG.
 */
const MenuCampos: React.FC<Props> = ({
  visivel,
  campos,
  campoAtivo,
  contarItens,
  aoFechar,
  aoTrocar,
  aoCriar,
  aoAtualizar,
  aoExcluir,
  embutido = false,
}) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { gesto, estiloArrasto, deslocY } = useArrastarParaFechar(aoFechar);
  const [edicao, setEdicao] = useState<Edicao>(null);

  useEffect(() => {
    if (visivel) {
      deslocY.value = 0;
    }
  }, [visivel, deslocY]);

  const confirmarExclusao = (campo: Campo) => {
    Alert.alert(
      `Excluir "${campo.nome}"`,
      'O campo e todos os itens cadastrados nele serão apagados deste aparelho. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => aoExcluir(campo.id) },
      ],
    );
  };

  const conteudo = (
    <>
      <Text style={estilos.titulo}>Campos</Text>
      <Text style={estilos.descricao}>
        Cada campo é um cofre separado, com os próprios itens e o próprio formulário de
        cadastro. Nada passa de um campo para o outro.
      </Text>

      <ScrollView style={estilos.scroll} showsVerticalScrollIndicator={false}>
        {campos.map((campo) => {
          const ativo = campo.id === campoAtivo.id;
          const total = contarItens(campo);

          return (
            <Pressable
              key={campo.id}
              onPress={() => {
                aoTrocar(campo.id);
                aoFechar();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={[estilos.linhaCampo, ativo && estilos.linhaCampoAtiva]}>
              <View style={estilos.textosLinha}>
                <Text
                  style={[estilos.nomeCampo, ativo && estilos.nomeCampoAtivo]}
                  numberOfLines={1}>
                  {campo.nome}
                </Text>
                <Text style={estilos.detalheCampo} numberOfLines={1}>
                  {campo.tipo === 'sig'
                    ? `Formulário do levantamento · ${total} competência${
                        total === 1 ? '' : 's'
                      }`
                    : `${campo.formulario.length} campo${
                        campo.formulario.length === 1 ? '' : 's'
                      } no cadastro · ${total} item${total === 1 ? '' : 'ns'}`}
                </Text>
              </View>

              {campo.tipo === 'livre' ? (
                <View style={estilos.acoesLinha}>
                  <Pressable
                    onPress={() => setEdicao({ modo: 'editar', campo })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar o formulário de ${campo.nome}`}
                    style={estilos.botaoLinha}>
                    <Text style={estilos.textoBotaoLinha}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmarExclusao(campo)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${campo.nome}`}
                    style={estilos.botaoExcluirLinha}>
                    <IconeX tamanho={13} cor={tema.erro} />
                  </Pressable>
                </View>
              ) : (
                <Text style={estilos.seloPadrao}>Padrão</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={estilos.rodape}>
        <Pressable onPress={aoFechar} style={estilos.botaoCancelar}>
          <Text style={estilos.textoBotaoCancelar}>Fechar</Text>
        </Pressable>
        <Pressable
          onPress={() => setEdicao({ modo: 'criar' })}
          style={estilos.botaoSalvar}
          accessibilityRole="button">
          <Text style={estilos.textoBotaoSalvar}>Adicionar novo campo</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <>
      {embutido ? (
        // Embutido, a folha É o painel: sem fundo escurecido e sem alça.
        // Enquanto o editor de campo está aberto, ele toma o lugar da lista —
        // os dois dividiriam os mesmos 35% e nenhum caberia.
        visivel && edicao === null ? <View style={estilos.painelEmbutido}>{conteudo}</View> : null
      ) : (
        <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoFechar}>
          <GestureHandlerRootView style={estilos.fundo}>
            <Animated.View style={estiloArrasto}>
              <View style={estilos.painel}>
                <GestureDetector gesture={gesto}>
                  <View style={estilos.areaPuxador}>
                    <View style={estilos.puxador} />
                  </View>
                </GestureDetector>

                {conteudo}
              </View>
            </Animated.View>
          </GestureHandlerRootView>
        </Modal>
      )}

      <EditorDeCampo
        embutido={embutido}
        edicao={edicao}
        aoCancelar={() => setEdicao(null)}
        aoConfirmar={(nome, formulario) => {
          if (edicao?.modo === 'editar') {
            aoAtualizar(edicao.campo.id, nome, formulario);
          } else {
            aoCriar(nome, formulario);
          }
          setEdicao(null);
          aoFechar();
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------

/**
 * Onde o formulário do campo é definido: a lista de perguntas do cadastro e o
 * tipo de cada uma. A primeira é sempre o título — é o que identifica o item no
 * cartão da lista e no nó do mapa, então ela não pode ser removida nem deixar
 * de ser obrigatória.
 */
const EditorDeCampo: React.FC<{
  edicao: Edicao;
  aoCancelar: () => void;
  aoConfirmar: (nome: string, formulario: RequisitoCampo[]) => void;
  /** Mesmo sentido do `embutido` de MenuCampos: painel fixo em vez de folha. */
  embutido: boolean;
}> = ({ edicao, aoCancelar, aoConfirmar, embutido }) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { gesto, estiloArrasto, deslocY } = useArrastarParaFechar(aoCancelar);

  const [nome, setNome] = useState('');
  const [requisitos, setRequisitos] = useState<RequisitoCampo[]>(formularioPadrao);

  // O modal não desmonta entre uma abertura e outra (só alterna `visible`), por
  // isso os valores são recarregados aqui a cada troca de `edicao`.
  const [ultimaEdicao, setUltimaEdicao] = useState<Edicao>(null);
  if (edicao !== ultimaEdicao) {
    setUltimaEdicao(edicao);
    if (edicao?.modo === 'editar') {
      setNome(edicao.campo.nome);
      setRequisitos(edicao.campo.formulario);
    } else if (edicao?.modo === 'criar') {
      setNome('');
      setRequisitos(formularioPadrao());
    }
    deslocY.value = 0;
  }

  const alterarRequisito = (id: string, mudanca: Partial<RequisitoCampo>) => {
    setRequisitos((atual) =>
      atual.map((requisito) => (requisito.id === id ? { ...requisito, ...mudanca } : requisito)),
    );
  };

  const confirmar = () => {
    if (!nome.trim()) {
      Alert.alert('Falta o nome', 'Dê um nome ao campo — é ele que aparece na troca de cofre.');
      return;
    }
    if (requisitos.some((requisito) => !requisito.rotulo.trim())) {
      Alert.alert('Requisito sem nome', 'Todo campo do cadastro precisa de um rótulo.');
      return;
    }
    aoConfirmar(nome, requisitos);
  };

  const conteudo = (
    <>
      <Text style={estilos.titulo}>
        {edicao?.modo === 'editar' ? 'Editar campo' : 'Novo campo'}
      </Text>
      <Text style={estilos.descricao}>
        Defina o que o cadastro deste cofre precisa ter. O primeiro item é o título que
        aparece na lista e no mapa.
      </Text>

      <ScrollView style={estilos.scroll} showsVerticalScrollIndicator={false}>
        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Nome do campo</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Contratos, Chamados, Diário de obras"
            placeholderTextColor={tema.textoTerciario}
            style={estilos.input}
          />
        </View>

        <Text style={estilos.secao}>Requisitos do cadastro</Text>

        {requisitos.map((requisito, indice) => {
          const eTitulo = indice === 0;

          return (
            <View key={requisito.id} style={estilos.cartaoRequisito}>
              <View style={estilos.linhaRequisito}>
                <TextInput
                  value={requisito.rotulo}
                  onChangeText={(texto) => alterarRequisito(requisito.id, { rotulo: texto })}
                  placeholder="Nome da pergunta"
                  placeholderTextColor={tema.textoTerciario}
                  style={[estilos.input, estilos.inputRequisito]}
                />
                {eTitulo ? null : (
                  <Pressable
                    onPress={() =>
                      setRequisitos((atual) =>
                        atual.filter((item) => item.id !== requisito.id),
                      )
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${requisito.rotulo || 'requisito'}`}
                    style={estilos.botaoExcluirLinha}>
                    <IconeX tamanho={13} cor={tema.erro} />
                  </Pressable>
                )}
              </View>

              <View style={estilos.faixaOpcoes}>
                <Pressable
                  onPress={() =>
                    alterarRequisito(requisito.id, {
                      tipo: TIPOS[(TIPOS.indexOf(requisito.tipo) + 1) % TIPOS.length],
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Tipo: ${ROTULO_TIPO[requisito.tipo]}. Tocar para trocar.`}
                  style={estilos.chip}>
                  <Text style={estilos.textoChip}>{ROTULO_TIPO[requisito.tipo]}</Text>
                </Pressable>

                {eTitulo ? (
                  <View style={[estilos.chip, estilos.chipAtivo]}>
                    <Text style={[estilos.textoChip, estilos.textoChipAtivo]}>
                      Título do item
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() =>
                      alterarRequisito(requisito.id, { obrigatorio: !requisito.obrigatorio })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: requisito.obrigatorio }}
                    style={[estilos.chip, requisito.obrigatorio && estilos.chipAtivo]}>
                    <Text
                      style={[
                        estilos.textoChip,
                        requisito.obrigatorio && estilos.textoChipAtivo,
                      ]}>
                      {requisito.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() =>
            setRequisitos((atual) => [
              ...atual,
              { id: gerarIdRequisito(), rotulo: '', tipo: 'texto', obrigatorio: false },
            ])
          }
          style={estilos.botaoAcrescentar}
          accessibilityRole="button">
          <Text style={estilos.textoBotaoAcrescentar}>+ Acrescentar requisito</Text>
        </Pressable>
      </ScrollView>

      <View style={estilos.rodape}>
        <Pressable onPress={aoCancelar} style={estilos.botaoCancelar}>
          <Text style={estilos.textoBotaoCancelar}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={confirmar} style={estilos.botaoSalvar}>
          <Text style={estilos.textoBotaoSalvar}>
            {edicao?.modo === 'editar' ? 'Salvar' : 'Criar campo'}
          </Text>
        </Pressable>
      </View>
    </>
  );

  if (embutido) {
    // No PC não há teclado virtual roubando altura, então o
    // KeyboardAvoidingView não tem trabalho a fazer — o painel é só uma coluna.
    return edicao !== null ? <View style={estilos.painelEmbutido}>{conteudo}</View> : null;
  }

  return (
    <Modal visible={edicao !== null} animationType="slide" transparent onRequestClose={aoCancelar}>
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

            {conteudo}
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: tema.overlay },
    painel: {
      maxHeight: '88%',
      backgroundColor: tema.fundoElevado,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 22,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: tema.borda,
    },
    /**
     * Versão PC do `painel`: mesma pele, mas ocupa a altura toda da coluna de
     * 35% em vez de subir do rodapé com cantos arredondados.
     */
    painelEmbutido: {
      flex: 1,
      minHeight: 0,
      backgroundColor: tema.fundoElevado,
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    areaPuxador: { alignItems: 'center', paddingVertical: 8, marginBottom: 6 },
    puxador: { width: 40, height: 4, borderRadius: 999, backgroundColor: tema.bordaForte },
    titulo: { color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    descricao: { color: tema.textoSecundario, fontSize: 12, lineHeight: 18, marginBottom: 8 },
    scroll: { flexShrink: 1 },
    linhaCampo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tema.borda,
      backgroundColor: tema.superficie,
    },
    linhaCampoAtiva: { borderColor: tema.primaria, backgroundColor: tema.primariaFundo },
    textosLinha: { flex: 1, minWidth: 0 },
    nomeCampo: { color: tema.texto, fontSize: 15, fontWeight: '700' },
    nomeCampoAtivo: { color: tema.primariaTexto },
    detalheCampo: { color: tema.textoSecundario, fontSize: 11, marginTop: 3 },
    acoesLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    botaoLinha: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoLinha: { color: tema.texto, fontSize: 11, fontWeight: '700' },
    botaoExcluirLinha: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tema.erroFundo,
    },
    seloPadrao: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    secao: {
      color: tema.primaria,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: 18,
      marginBottom: 2,
    },
    bloco: { marginTop: 10 },
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
    inputRequisito: { flex: 1, minWidth: 0 },
    cartaoRequisito: {
      marginTop: 10,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tema.borda,
      backgroundColor: tema.fundo,
    },
    linhaRequisito: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    faixaOpcoes: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    chipAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
    textoChip: { color: tema.textoSecundario, fontSize: 11, fontWeight: '700' },
    textoChipAtivo: { color: tema.primariaTexto },
    botaoAcrescentar: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tema.bordaForte,
    },
    textoBotaoAcrescentar: { color: tema.primariaTexto, fontSize: 12, fontWeight: '700' },
    rodape: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
    },
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

export default MenuCampos;
