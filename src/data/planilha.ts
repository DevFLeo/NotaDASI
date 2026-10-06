/**
 * A planilha do diagnóstico INTEIRA, aba por aba, como veio do Excel.
 *
 * O levantamento (src/data/registros.ts) só aproveita as abas das secretarias,
 * e já interpretadas: Sim/Não viram booleanos, a lotação vira campos. Esta é a
 * outra metade — inclusive as abas de resumo ("Estrutura interna", "Página6"...)
 * —, para a tela "Planilha" mostrar exatamente o que está na pasta de trabalho.
 *
 * Os dados vêm de planilha.gerado.ts, produzido por
 * `python scripts/importacao_de_xlsx.py <planilha.xlsx> --abas-ts src/data/planilha.gerado.ts`.
 */

export type LinhaPlanilha = {
  /** Número da linha no Excel — para a pessoa achar a mesma linha no arquivo. */
  linha: number;
  /** Um texto por coluna, na ordem de `colunas`. Vazio = célula vazia. */
  valores: string[];
};

export type AbaPlanilha = {
  nome: string;
  colunas: string[];
  /** Índices das colunas de lotação (secretaria/departamento/setor). */
  colunasLotacao: number[];
  linhas: LinhaPlanilha[];
};

/**
 * Título do cartão de uma linha: o nível mais específico da lotação preenchido
 * (o setor; se não houver, o departamento...). Linha sem lotação usa a
 * primeira célula preenchida.
 */
export const tituloDaLinha = (aba: AbaPlanilha, linha: LinhaPlanilha): string => {
  for (let i = aba.colunasLotacao.length - 1; i >= 0; i -= 1) {
    const valor = linha.valores[aba.colunasLotacao[i]];
    if (valor) {
      return valor;
    }
  }
  return linha.valores.find(Boolean) ?? `Linha ${linha.linha}`;
};

/** Os níveis acima do título (secretaria › departamento), para o subtítulo. */
export const caminhoDaLinha = (aba: AbaPlanilha, linha: LinhaPlanilha): string => {
  const titulo = tituloDaLinha(aba, linha);
  return aba.colunasLotacao
    .map((indice) => linha.valores[indice])
    .filter((valor) => valor && valor !== titulo)
    .join(' › ');
};

/** Pares coluna/valor preenchidos, sem a lotação (que já está no título). */
export const camposDaLinha = (
  aba: AbaPlanilha,
  linha: LinhaPlanilha,
): { coluna: string; valor: string }[] => {
  const lotacao = new Set(aba.colunasLotacao);
  return aba.colunas
    .map((coluna, indice) => ({ coluna, valor: linha.valores[indice] ?? '' }))
    .filter((campo, indice) => campo.valor && !lotacao.has(indice));
};

const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Filtra as linhas da aba pelo termo, sem diferenciar acento nem maiúscula. */
export const filtrarLinhas = (aba: AbaPlanilha, termo: string): LinhaPlanilha[] => {
  const alvo = normalizar(termo.trim());
  if (!alvo) {
    return aba.linhas;
  }
  return aba.linhas.filter((linha) => normalizar(linha.valores.join(' ')).includes(alvo));
};
