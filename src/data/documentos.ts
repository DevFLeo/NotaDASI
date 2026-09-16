/**
 * Documentos anexados ao levantamento.
 *
 * Um documento NAO pertence a uma competencia: ele pertence a um ALVO, que
 * pode ser o departamento inteiro, uma divisao (setor) ou uma pessoa
 * (responsavel). E o mesmo criterio de quem responde pelo documento no mundo
 * real — portaria da divisao, ficha de treinamento da pessoa, etc.
 *
 * Este arquivo e TypeScript puro (sem React Native e sem DOM) de proposito:
 * o app mobile e a versao web usam o mesmo modelo, cada um com o seu
 * armazenamento (AsyncStorage / localStorage).
 */

import type { Registro } from './registros';

export type TipoDocumento =
  | 'oficio'
  | 'portaria'
  | 'ata'
  | 'manual'
  | 'planilha'
  | 'mapa'
  | 'outro';

export const rotuloTipoDocumento: Record<TipoDocumento, string> = {
  oficio: 'Ofício',
  portaria: 'Portaria',
  ata: 'Ata',
  manual: 'Manual / tutorial',
  planilha: 'Planilha',
  mapa: 'Mapa / planta',
  outro: 'Outro',
};

export const iconeTipoDocumento: Record<TipoDocumento, string> = {
  oficio: '✉️',
  portaria: '⚖️',
  ata: '🗒️',
  manual: '📘',
  planilha: '📊',
  mapa: '🗺️',
  outro: '📎',
};

/** A quem o documento esta alocado. */
export type TipoAlvo = 'departamento' | 'divisao' | 'pessoa';

export const rotuloTipoAlvo: Record<TipoAlvo, string> = {
  departamento: 'Departamento',
  divisao: 'Divisão',
  pessoa: 'Pessoa',
};

export type Documento = {
  id: string;

  titulo: string;
  tipo: TipoDocumento;

  /** Alvo: departamento, divisao (sigla do setor) ou pessoa (nome normalizado). */
  alvoTipo: TipoAlvo;
  alvoId: string;
  /** Rotulo legivel do alvo, guardado junto para o documento sobreviver a mudancas na planilha. */
  alvoRotulo: string;

  descricao?: string;

  /** Link externo (Drive, SEI, intranet...). */
  url?: string;

  /** Arquivo embutido em base64 (data URL). Use apenas para arquivos pequenos. */
  arquivoNome?: string;
  arquivoTipo?: string;
  arquivoTamanho?: number;
  arquivoDados?: string;

  criadoEm: string;
};

/** Limite do arquivo embutido — acima disso, prefira o campo de link. */
export const LIMITE_ARQUIVO_BYTES = 2 * 1024 * 1024;

/** Normaliza um nome para virar identificador estavel (sem acento, sem espaco). */
export const normalizarChave = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const idDaDivisao = (registro: Registro): string =>
  normalizarChave(registro.setorSigla || registro.setor);

export const idDaPessoa = (registro: Registro): string => normalizarChave(registro.responsavel);

export const idDoDepartamento = (registro: Registro): string =>
  normalizarChave(registro.departamentoSigla || registro.departamento);

/** Alvos disponiveis para anexar um documento, derivados dos registros. */
export type AlvoDisponivel = {
  tipo: TipoAlvo;
  id: string;
  rotulo: string;
  /** Contexto mostrado no seletor (ex.: divisao a que a pessoa pertence). */
  detalhe: string;
};

export const listarAlvos = (registros: Registro[]): AlvoDisponivel[] => {
  const alvos = new Map<string, AlvoDisponivel>();

  registros.forEach((registro) => {
    const departamento: AlvoDisponivel = {
      tipo: 'departamento',
      id: idDoDepartamento(registro),
      rotulo: registro.departamentoSigla || registro.departamento,
      detalhe: registro.departamento,
    };
    alvos.set(`departamento:${departamento.id}`, departamento);

    if (registro.setorSigla || registro.setor) {
      const divisao: AlvoDisponivel = {
        tipo: 'divisao',
        id: idDaDivisao(registro),
        rotulo: registro.setorSigla || registro.setor,
        detalhe: registro.setor,
      };
      alvos.set(`divisao:${divisao.id}`, divisao);
    }

    if (registro.responsavel) {
      const pessoa: AlvoDisponivel = {
        tipo: 'pessoa',
        id: idDaPessoa(registro),
        rotulo: registro.responsavel,
        detalhe: `${registro.cargo || 'Servidor(a)'} · ${registro.setorSigla || registro.setor}`,
      };
      alvos.set(`pessoa:${pessoa.id}`, pessoa);
    }
  });

  const ordem: Record<TipoAlvo, number> = { departamento: 0, divisao: 1, pessoa: 2 };

  return [...alvos.values()].sort(
    (a, b) => ordem[a.tipo] - ordem[b.tipo] || a.rotulo.localeCompare(b.rotulo),
  );
};

/** Documentos de um alvo especifico (ex.: todos da divisao DICI). */
export const documentosDoAlvo = (
  documentos: Documento[],
  tipo: TipoAlvo,
  id: string,
): Documento[] => documentos.filter((doc) => doc.alvoTipo === tipo && doc.alvoId === id);

/** Chave usada para indexar documentos por alvo. */
export const chaveAlvo = (tipo: TipoAlvo, id: string): string => `${tipo}:${id}`;

export const agruparPorAlvo = (documentos: Documento[]): Map<string, Documento[]> => {
  const mapa = new Map<string, Documento[]>();
  documentos.forEach((doc) => {
    const chave = chaveAlvo(doc.alvoTipo, doc.alvoId);
    mapa.set(chave, [...(mapa.get(chave) ?? []), doc]);
  });
  return mapa;
};

/** Erros de preenchimento — lista vazia significa documento valido. */
export const validarDocumento = (documento: Partial<Documento>): string[] => {
  const erros: string[] = [];

  if (!documento.titulo?.trim()) {
    erros.push('Informe o título do documento.');
  }
  if (!documento.alvoId) {
    erros.push('Escolha a divisão ou a pessoa responsável pelo documento.');
  }
  if (!documento.url?.trim() && !documento.arquivoDados) {
    erros.push('Anexe um arquivo ou informe um link.');
  }
  if (documento.arquivoTamanho && documento.arquivoTamanho > LIMITE_ARQUIVO_BYTES) {
    erros.push('Arquivo maior que 2 MB — use o campo de link.');
  }

  return erros;
};

export const formatarTamanho = (bytes?: number): string => {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const novoId = (): string =>
  `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
