/**
 * Ponte entre o código do app (que importa de 'react-native') e o navegador.
 *
 * O react-native-web cobre quase tudo que o NotaDASI usa — View, Text,
 * Pressable, ScrollView, FlatList, Modal, TextInput, StyleSheet, etc. —
 * mas NÃO implementa três coisas que o app chama. Em vez de espalhar
 * `Platform.OS === 'web'` por 6 arquivos do app, reimplementamos as três
 * aqui e o Vite aponta 'react-native' para este módulo (ver vite.config.ts).
 *
 * Os exports locais abaixo têm precedência sobre o `export *` (regra de
 * ESM), então se uma versão futura do react-native-web passar a exportar
 * Alert, este arquivo continua mandando — e é aqui que se remove o shim.
 */
export * from 'react-native-web';

type BotaoAlerta = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Alert do RN sobre os diálogos do navegador.
 *
 * Sem botões (ou com um só) vira `window.alert`. Com dois vira
 * `window.confirm`, onde OK dispara o primeiro botão que NÃO é 'cancel' —
 * é assim que as chamadas do app estão escritas (Cancelar + ação).
 */
export const Alert = {
  alert: (titulo: string, mensagem?: string, botoes?: BotaoAlerta[]): void => {
    const texto = mensagem ? `${titulo}\n\n${mensagem}` : titulo;

    if (!botoes || botoes.length === 0) {
      window.alert(texto);
      return;
    }

    const confirmar = botoes.find((botao) => botao.style !== 'cancel');
    const cancelar = botoes.find((botao) => botao.style === 'cancel');

    if (botoes.length === 1) {
      window.alert(texto);
      botoes[0].onPress?.();
      return;
    }

    if (window.confirm(texto)) {
      confirmar?.onPress?.();
    } else {
      cancelar?.onPress?.();
    }
  },
};

/**
 * Clipboard do RN sobre a API do navegador.
 *
 * `navigator.clipboard` exige contexto seguro (https ou localhost) — como o
 * alvo aqui é localhost, funciona. A falha é silenciosa de propósito: copiar
 * um telefone não pode derrubar a tela (mesmo critério do app nativo).
 */
export const Clipboard = {
  setString: (texto: string): void => {
    navigator.clipboard?.writeText(texto).catch(() => {
      // Navegador negou o acesso à área de transferência — segue sem copiar.
    });
  },
};

/**
 * No Android isto é a ponte JNI da busca rápida em C++ (cpp/nota_busca_rapida.cpp).
 * No navegador não existe módulo nativo nenhum: devolvemos um objeto vazio para
 * que src/native/NotaBuscaRapida.ts caia no fallback em JS puro que ele já tem.
 */
export const NativeModules: Record<string, unknown> = {};
