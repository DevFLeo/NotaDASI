import type { ColunaKanban, DecisaoParecerUrgencia, Registro } from './registros';

export type DefinicaoColunaKanban = {
  id: ColunaKanban;
  titulo: string;
  descricao: string;
};

export const COLUNAS_KANBAN: DefinicaoColunaKanban[] = [
  {
    id: 'nao_iniciado',
    titulo: 'Não iniciado',
    descricao: 'Competências ainda sem início operacional no SIG.',
  },
  {
    id: 'em_processo',
    titulo: 'Em processo',
    descricao: 'Competências em implantação, capacitação ou liberação de acesso.',
  },
  {
    id: 'urgencia',
    titulo: 'Urgência',
    descricao: 'Calculada por pendências críticas, respostas "Não", não estruturado ou problemas.',
  },
  {
    id: 'revisao',
    titulo: 'Revisão',
    descricao: 'Itens encaminhados para revisão e definição de continuidade.',
  },
  {
    id: 'concluido',
    titulo: 'Concluído',
    descricao: 'Competências aderidas ou encerradas mediante parecer.',
  },
];

export const rotuloColunaKanban: Record<ColunaKanban, string> = {
  nao_iniciado: 'Não iniciado',
  em_processo: 'Em processo',
  urgencia: 'Urgência',
  revisao: 'Revisão',
  concluido: 'Concluído',
};

export const rotuloDecisaoParecer: Record<DecisaoParecerUrgencia, string> = {
  concluido: 'Concluído',
  revisao: 'Revisão / Continuidade',
  em_processo: 'Em processo',
};

export type FatorUrgencia = {
  codigo: string;
  rotulo: string;
  peso: number;
};

export type NivelUrgencia = 'nenhuma' | 'atencao' | 'urgente' | 'critica';

export type AvaliacaoUrgencia = {
  pontuacao: number;
  nivel: NivelUrgencia;
  eUrgente: boolean;
  fatores: FatorUrgencia[];
};

/** Normaliza um número de processo SEI opcional (retorna undefined se vazio). */
export const normalizarNumeroSei = (valor?: string): string | undefined => {
  if (!valor) return undefined;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : undefined;
};

/**
 * Calcula a pontuação de urgência de uma competência a partir das respostas
 * negativas, pendências, ausência de estruturação no sistema e problemas no SIG.
 *
 * Critérios ponderados:
 * - Problema relatado no SIG: +3
 * - Problema sem chamado aberto: +2
 * - Sistema não atende: +3
 * - Não estruturado no sistema: +2
 * - Treinamento pendente ("Não"): +1
 * - Acesso à camada pendente ("Não"): +1
 * - Acesso ao módulo pendente ("Não"): +1
 * - Atividade não iniciada ("Não"): +1
 *
 * Entra automaticamente em Urgência quando:
 * - pontuação >= 4, OU
 * - há problema relatado no SIG (`temProblema === true`), OU
 * - o sistema não atende e não está estruturado (`sistemaAtende === false && estruturadoNoSistema === false`).
 */
export const calcularUrgencia = (registro: Registro): AvaliacaoUrgencia => {
  const fatores: FatorUrgencia[] = [];

  if (registro.temProblema === true) {
    fatores.push({
      codigo: 'PROBLEMA_SIG',
      rotulo: 'Problema relatado no SIG',
      peso: 3,
    });
    if (registro.temChamado === false) {
      fatores.push({
        codigo: 'SEM_CHAMADO',
        rotulo: 'Problema sem chamado aberto',
        peso: 2,
      });
    }
  }

  if (registro.sistemaAtende === false) {
    fatores.push({
      codigo: 'NAO_ATENDE',
      rotulo: 'Sistema não atende',
      peso: 3,
    });
  }

  if (registro.estruturadoNoSistema === false) {
    fatores.push({
      codigo: 'NAO_ESTRUTURADO',
      rotulo: 'Não estruturado no sistema',
      peso: 2,
    });
  }

  if (registro.houveTreinamento === false) {
    fatores.push({
      codigo: 'TREINAMENTO_PENDENTE',
      rotulo: 'Treinamento pendente',
      peso: 1,
    });
  }

  if (registro.acessoCamadaConcedido === false) {
    fatores.push({
      codigo: 'ACESSO_CAMADA_PENDENTE',
      rotulo: 'Acesso à camada pendente',
      peso: 1,
    });
  }

  if (registro.acessoModuloConcedido === false) {
    fatores.push({
      codigo: 'ACESSO_MODULO_PENDENTE',
      rotulo: 'Acesso ao módulo pendente',
      peso: 1,
    });
  }

  if (registro.iniciouAtividade === false) {
    fatores.push({
      codigo: 'NAO_INICIADO',
      rotulo: 'Atividade não iniciada',
      peso: 1,
    });
  }

  const pontuacao = fatores.reduce((soma, f) => soma + f.peso, 0);
  const eUrgente =
    pontuacao >= 4 ||
    registro.temProblema === true ||
    (registro.sistemaAtende === false && registro.estruturadoNoSistema === false);

  let nivel: NivelUrgencia = 'nenhuma';
  if (pontuacao >= 7) {
    nivel = 'critica';
  } else if (eUrgente) {
    nivel = 'urgente';
  } else if (pontuacao >= 1) {
    nivel = 'atencao';
  }

  return {
    pontuacao,
    nivel,
    eUrgente,
    fatores,
  };
};

/**
 * Classificação automática da coluna Kanban quando não há decisão manual ou parecer.
 */
export const calcularColunaKanbanAutomatica = (registro: Registro): ColunaKanban => {
  const urgencia = calcularUrgencia(registro);
  if (urgencia.eUrgente) {
    return 'urgencia';
  }

  if (
    registro.sistemaAtende === true &&
    registro.iniciouAtividade === true &&
    registro.temProblema !== true &&
    urgencia.pontuacao === 0
  ) {
    return 'concluido';
  }

  const temProgressoParcial =
    registro.iniciouAtividade === true ||
    (registro.sistemaAtende === true &&
      (registro.estruturadoNoSistema === true ||
        registro.houveTreinamento === true ||
        registro.acessoCamadaConcedido === true ||
        registro.acessoModuloConcedido === true));

  if (temProgressoParcial) {
    return 'em_processo';
  }

  return 'nao_iniciado';
};

/**
 * Coluna efetiva do card no Kanban: respeita a decisão manual / parecer de urgência
 * quando existir, caso contrário usa a classificação automática.
 */
export const obterColunaKanban = (registro: Registro): ColunaKanban =>
  registro.kanban?.colunaManual ?? calcularColunaKanbanAutomatica(registro);
