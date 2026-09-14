import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferência de integração com um servidor remoto (Postgres por trás de uma
 * API — ver db/schema.sql e src/data/useRegistros.ts).
 *
 * Isso hoje é só a PREPARAÇÃO: guarda a URL que o usuário informar, mas
 * nenhum dado é enviado para ela ainda — o app segue 100% local
 * (AsyncStorage) até essa integração ser implementada de fato.
 */
const CHAVE_URL_SERVIDOR = '@notadasi:servidor-url';

export const lerUrlServidor = async (): Promise<string> => {
  try {
    return (await AsyncStorage.getItem(CHAVE_URL_SERVIDOR)) ?? '';
  } catch {
    return '';
  }
};

export const salvarUrlServidor = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAVE_URL_SERVIDOR, url.trim());
  } catch {
    // Falha ao salvar não pode derrubar o app.
  }
};
