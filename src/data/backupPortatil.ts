import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Anotacao, Campo } from './campos';
import type { ContatoIntegrado } from './contatosIntegrados';
import { CHAVE_CONTATOS_MANUAIS } from './useContatos';
import type { Registro } from './registros';
import type { AceiteExcelInfo } from './useRegistros';
import { lerPosicoes, salvarPosicoes, type PosicoesSalvas } from '../mapa/posicoes';

const CHAVE_CAMPOS = '@notadasi:campos';
const CHAVE_ANOTACOES = '@notadasi:campos-anotacoes';
const CHAVE_ACEITE_EXCEL = '@notadasi:aceite-excel';
const CHAVE_FAVORITOS = '@notadasi:registros-favoritos';

export type PacoteBackupNotaDASI = {
  formato: 'notadasi-backup';
  versao: 1;
  exportadoEm: string;
  origem: 'app' | 'cli';
  totalRegistros: number;
  nomePlanilhaAtiva?: string;
  aceiteExcel?: AceiteExcelInfo | null;
  registros: Registro[];
  campos?: Campo[];
  anotacoes?: Record<string, Anotacao[]>;
  contatosManuais?: ContatoIntegrado[];
  posicoesMapa?: PosicoesSalvas;
};

const lerJsonSeguro = async <T,>(chave: string, padrao: T): Promise<T> => {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    if (!bruto) return padrao;
    const parsed = JSON.parse(bruto);
    return parsed ?? padrao;
  } catch {
    return padrao;
  }
};

/**
 * Monta um pacote portatil completo com TODOS os dados locais do NotaDASI
 * (competencias, comentarios, notas pessoais, favoritos, aceite Excel,
 * campos livres/anotacoes e posicoes personalizadas do mapa mental).
 */
export const gerarPacoteBackup = async (params: {
  registros: Registro[];
  aceiteExcel?: AceiteExcelInfo | null;
  nomePlanilhaAtiva?: string;
}): Promise<PacoteBackupNotaDASI> => {
  const [campos, anotacoes, contatosManuais, posicoesMapa] = await Promise.all([
    lerJsonSeguro<Campo[]>(CHAVE_CAMPOS, []),
    lerJsonSeguro<Record<string, Anotacao[]>>(CHAVE_ANOTACOES, {}),
    lerJsonSeguro<ContatoIntegrado[]>(CHAVE_CONTATOS_MANUAIS, []),
    lerPosicoes(),
  ]);

  // Limpa campos internos transitorios (ex: _stamp) antes de exportar
  const registrosLimpos: Registro[] = params.registros.map((r) => {
    const copia = { ...r };
    delete copia._stamp;
    return copia;
  });

  return {
    formato: 'notadasi-backup',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    origem: 'app',
    totalRegistros: registrosLimpos.length,
    nomePlanilhaAtiva: params.nomePlanilhaAtiva || undefined,
    aceiteExcel: params.aceiteExcel ?? null,
    registros: registrosLimpos,
    campos,
    anotacoes,
    contatosManuais,
    posicoesMapa,
  };
};

/**
 * Valida e restaura um backup portatil (.json) exportado de outro PC ou do CLI.
 * Retorna os registros extraidos e metadados para aplicacao imediata na sessao.
 */
export const lerERestaurarBackupJson = async (
  conteudoJson: string,
  nomeArquivo?: string,
): Promise<{
  registros: Registro[];
  nomeBase: string;
  camposRestaurados: number;
  posicoesRestauradas: number;
}> => {
  let parsed: any;
  try {
    parsed = JSON.parse(conteudoJson);
  } catch {
    throw new Error('O arquivo selecionado nao e um JSON valido.');
  }

  const registros: Registro[] | null = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.registros)
      ? parsed.registros
      : null;

  if (!registros || registros.length === 0) {
    throw new Error('Nenhum registro de competencia encontrado no arquivo de backup.');
  }

  // Restaura favoritos marcados nos registros
  const favoritosIds = registros.filter((r) => r.favorito === true).map((r) => r.id);
  await AsyncStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(favoritosIds)).catch(() => {});

  // Restaura aceite Excel se presente no pacote
  if (parsed?.aceiteExcel && typeof parsed.aceiteExcel === 'object') {
    await AsyncStorage.setItem(CHAVE_ACEITE_EXCEL, JSON.stringify(parsed.aceiteExcel)).catch(() => {});
  }

  // Restaura campos livres e anotacoes se presentes
  let camposRestaurados = 0;
  if (Array.isArray(parsed?.campos) && parsed.campos.length > 0) {
    await AsyncStorage.setItem(CHAVE_CAMPOS, JSON.stringify(parsed.campos)).catch(() => {});
    camposRestaurados = parsed.campos.length;
  }
  if (parsed?.anotacoes && typeof parsed.anotacoes === 'object') {
    await AsyncStorage.setItem(CHAVE_ANOTACOES, JSON.stringify(parsed.anotacoes)).catch(() => {});
  }

  // Restaura contatos manuais se presentes
  if (Array.isArray(parsed?.contatosManuais)) {
    await AsyncStorage.setItem(CHAVE_CONTATOS_MANUAIS, JSON.stringify(parsed.contatosManuais)).catch(() => {});
  }

  // Restaura posicoes do mapa mental se presentes
  let posicoesRestauradas = 0;
  if (parsed?.posicoesMapa && typeof parsed.posicoesMapa === 'object') {
    await salvarPosicoes(parsed.posicoesMapa);
    posicoesRestauradas = Object.keys(parsed.posicoesMapa).length;
  }

  const nomeBase =
    parsed?.nomePlanilhaAtiva ||
    (nomeArquivo ? `Backup: ${nomeArquivo}` : 'Backup importado (.json)');

  return {
    registros,
    nomeBase,
    camposRestaurados,
    posicoesRestauradas,
  };
};
