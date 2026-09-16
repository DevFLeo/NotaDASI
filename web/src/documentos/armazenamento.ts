import {
  LIMITE_ARQUIVO_BYTES,
  type Documento,
} from '../../../src/data/documentos';

/**
 * Persistencia da versao web: localStorage.
 *
 * O app mobile guarda a mesma estrutura no AsyncStorage (src/mapa/posicoes.ts
 * usa a mesma estrategia para as posicoes dos nos), entao o JSON exportado
 * aqui pode ser lido la e vice-versa.
 */
const CHAVE_DOCUMENTOS = '@notadasi:web:documentos';
const CHAVE_POSICOES = '@notadasi:web:posicoes';
const CHAVE_PREFERENCIAS = '@notadasi:web:preferencias';

const ler = <T,>(chave: string, padrao: T): T => {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) {
      return padrao;
    }
    const dados = JSON.parse(bruto);
    return (dados ?? padrao) as T;
  } catch {
    // Storage bloqueado ou JSON corrompido: segue com o padrao.
    return padrao;
  }
};

const gravar = (chave: string, valor: unknown): void => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Cota estourada (arquivo grande demais) ou modo privativo: ignora.
  }
};

export const lerDocumentos = (): Documento[] => {
  const dados = ler<Documento[]>(CHAVE_DOCUMENTOS, []);
  return Array.isArray(dados) ? dados : [];
};

export const salvarDocumentos = (documentos: Documento[]): void =>
  gravar(CHAVE_DOCUMENTOS, documentos);

export type PosicoesSalvas = Record<string, { x: number; y: number }>;

export const lerPosicoes = (): PosicoesSalvas => ler<PosicoesSalvas>(CHAVE_POSICOES, {});

export const salvarPosicoes = (posicoes: PosicoesSalvas): void => gravar(CHAVE_POSICOES, posicoes);

export type Preferencias = {
  mostrarDocumentos: boolean;
  mostrarCamadas: boolean;
};

export const preferenciasPadrao: Preferencias = {
  mostrarDocumentos: true,
  mostrarCamadas: true,
};

export const lerPreferencias = (): Preferencias => ({
  ...preferenciasPadrao,
  ...ler<Partial<Preferencias>>(CHAVE_PREFERENCIAS, {}),
});

export const salvarPreferencias = (preferencias: Preferencias): void =>
  gravar(CHAVE_PREFERENCIAS, preferencias);

/** Le um arquivo escolhido no <input type="file"> como data URL (base64). */
export const lerArquivo = (
  arquivo: File,
): Promise<{ nome: string; tipo: string; tamanho: number; dados: string }> =>
  new Promise((resolver, rejeitar) => {
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
      rejeitar(new Error('Arquivo maior que 2 MB — use o campo de link.'));
      return;
    }

    const leitor = new FileReader();
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () =>
      resolver({
        nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream',
        tamanho: arquivo.size,
        dados: String(leitor.result),
      });
    leitor.readAsDataURL(arquivo);
  });

/** Baixa o acervo inteiro (documentos + posicoes) como um arquivo .json. */
export const exportarAcervo = (documentos: Documento[]): void => {
  const conteudo = JSON.stringify(
    { versao: 1, exportadoEm: new Date().toISOString(), documentos, posicoes: lerPosicoes() },
    null,
    2,
  );

  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `notadasi-documentos-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/** Le um .json exportado antes e devolve os documentos contidos nele. */
export const importarAcervo = async (arquivo: File): Promise<Documento[]> => {
  const texto = await arquivo.text();
  const dados = JSON.parse(texto);
  const lista = Array.isArray(dados) ? dados : dados?.documentos;

  if (!Array.isArray(lista)) {
    throw new Error('Arquivo sem a lista de documentos.');
  }

  return lista as Documento[];
};
