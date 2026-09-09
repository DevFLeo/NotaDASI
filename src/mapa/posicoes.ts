import AsyncStorage from '@react-native-async-storage/async-storage';

export type PosicaoSalva = { x: number; y: number };
export type PosicoesSalvas = Record<string, PosicaoSalva>;

const CHAVE = '@notadasi:posicoes-mapa';

/** Le as posicoes que o usuario arrastou em sessoes anteriores. */
export const lerPosicoes = async (): Promise<PosicoesSalvas> => {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (!bruto) {
      return {};
    }

    const dados = JSON.parse(bruto);
    return typeof dados === 'object' && dados !== null ? (dados as PosicoesSalvas) : {};
  } catch {
    // Storage indisponivel ou JSON corrompido: volta ao layout automatico.
    return {};
  }
};

export const salvarPosicoes = async (posicoes: PosicoesSalvas): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(posicoes));
  } catch {
    // Falha ao salvar nao pode derrubar a tela — a sessao atual segue normal.
  }
};

export const limparPosicoes = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CHAVE);
  } catch {
    // Ignorado de proposito.
  }
};
