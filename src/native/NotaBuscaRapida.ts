import { NativeModules, Platform } from 'react-native';

type NotaBuscaRapidaModulo = {
  buscarOcorrencias(textoCompleto: string, termoBusca: string): Promise<number[]>;
  descriptografarSimulado(textoCriptografado: string): Promise<string>;
};

/**
 * Normaliza texto para busca: minusculas e sem acentos.
 *
 * IMPORTANTE: precisa produzir o mesmo resultado que `nota_dasi::normalizarTexto`
 * em cpp/nota_busca_rapida.cpp — senao o caminho nativo e o fallback JS passam a
 * encontrar coisas diferentes.
 */
export const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const buscarOcorrenciasEmJs = (textoCompleto: string, termoBusca: string): number[] => {
  const ocorrencias: number[] = [];

  if (!termoBusca || !textoCompleto) {
    return ocorrencias;
  }

  const textoNormalizado = normalizarTexto(textoCompleto);
  const termoNormalizado = normalizarTexto(termoBusca);

  let posicaoAtual = textoNormalizado.indexOf(termoNormalizado);
  while (posicaoAtual !== -1) {
    ocorrencias.push(posicaoAtual);
    posicaoAtual = textoNormalizado.indexOf(termoNormalizado, posicaoAtual + termoNormalizado.length);
  }

  return ocorrencias;
};

const descriptografarSimuladoEmJs = (textoCriptografado: string): string =>
  textoCriptografado
    .split('')
    .map((caractere) => String.fromCharCode(caractere.charCodeAt(0) - 3))
    .join('');

// Fallback em JS puro, usado quando a biblioteca nativa (JNI) nao esta disponivel
// para a plataforma/ABI atual — mantem o app funcional em vez de quebrar a busca.
const fallbackJs: NotaBuscaRapidaModulo = {
  buscarOcorrencias: async (textoCompleto, termoBusca) =>
    buscarOcorrenciasEmJs(textoCompleto, termoBusca),
  descriptografarSimulado: async (textoCriptografado) =>
    descriptografarSimuladoEmJs(textoCriptografado),
};

const moduloNativo: Partial<NotaBuscaRapidaModulo> | undefined =
  Platform.OS === 'android'
    ? (NativeModules.NotaBuscaRapida as Partial<NotaBuscaRapidaModulo> | undefined)
    : undefined;

const NotaBuscaRapida: NotaBuscaRapidaModulo = {
  buscarOcorrencias: async (textoCompleto, termoBusca) => {
    try {
      const resultado = await moduloNativo?.buscarOcorrencias?.(textoCompleto, termoBusca);
      if (resultado) {
        return resultado;
      }
    } catch {
      // Silencioso de proposito: qualquer falha nativa cai no fallback abaixo.
    }

    return fallbackJs.buscarOcorrencias(textoCompleto, termoBusca);
  },

  descriptografarSimulado: async (textoCriptografado) => {
    try {
      const resultado = await moduloNativo?.descriptografarSimulado?.(textoCriptografado);
      if (resultado !== undefined) {
        return resultado;
      }
    } catch {
      // Silencioso de proposito: qualquer falha nativa cai no fallback abaixo.
    }

    return fallbackJs.descriptografarSimulado(textoCriptografado);
  },
};

export default NotaBuscaRapida;
