import type { Registro } from './registros';

export type GravidadeRegra = 'alta' | 'media' | 'baixa';

export type TipoRegra =
  | 'SECRETARIA'
  | 'RESPONSAVEL'
  | 'COMPETENCIA'
  | 'CONTATO'
  | 'SIG_ATENDIMENTO'
  | 'SIG_PROBLEMA'
  | 'TREINAMENTO';

export type QuebraRegra = {
  id: string;
  registroId: string;
  secretaria: string;
  setor: string;
  competencia: string;
  tipo: TipoRegra;
  gravidade: GravidadeRegra;
  titulo: string;
  descricao: string;
  sugestaoAjuste: string;
};

export type RelatorioConformidade = {
  totalRegistros: number;
  totalConformes: number;
  totalComQuebra: number;
  taxaConformidade: number; // 0 a 100
  quebras: QuebraRegra[];
  quebrasPorGravidade: { alta: number; media: number; baixa: number };
  quebrasPorTipo: Record<TipoRegra, number>;
  statusGeral: 'conforme' | 'com_ressalvas' | 'critico';
};

/**
 * Secretarias e órgãos oficiais do organograma da Prefeitura de Porto Velho
 * (extraídas da estrutura organizacional oficial e do diagnóstico do SIG Geo 360).
 */
export const SECRETARIAS_OFICIAIS = [
  'SEMUR',
  'SEMFAZ',
  'SEMUSB',
  'SEMA',
  'SEMTRAN',
  'SEMUSA',
  'SEMED',
  'SEINFRA',
  'SEMIAS',
  'SEMASF',
  'SEMAGRIC',
  'SEMAD',
  'SML',
  'PGM',
  'CGM',
  'GABINETE',
  'SECET',
  'SEMESC',
  'IPAM',
  'EMDUR',
];

const normalizar = (texto: string = ''): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const pertenceASecretariaOficial = (departamento: string, sigla: string): boolean => {
  const normDep = normalizar(departamento);
  const normSigla = normalizar(sigla);
  return SECRETARIAS_OFICIAIS.some((sec) => {
    const normSec = normalizar(sec);
    return (
      normSigla === normSec ||
      normDep.includes(normSec) ||
      (normSec === 'SEMASF' && normDep.includes('SEMIAS'))
    );
  });
};

/**
 * Validador das Regras de Negócio Municipais para a Planilha do Diagnóstico SIG Geo 360.
 *
 * Avalia cada registro contra o regimento de adesão e diretrizes do DASI / DGEO:
 * 1. Lotação regimental em secretaria oficial do município
 * 2. Identificação nominal do responsável do setor
 * 3. Descrição clara da competência regimental
 * 4. Contato institucional obrigatório (ramal ou e-mail oficial)
 * 5. Coerência do atendimento pelo SIG
 * 6. Detalhamento e abertura de chamado para problemas reportados
 * 7. Capacitação prévia para permissão de acesso à camada de dados
 */
export function validarRegrasPlanilha(registros: Registro[]): RelatorioConformidade {
  const quebras: QuebraRegra[] = [];
  const quebrasPorGravidade = { alta: 0, media: 0, baixa: 0 };
  const quebrasPorTipo: Record<TipoRegra, number> = {
    SECRETARIA: 0,
    RESPONSAVEL: 0,
    COMPETENCIA: 0,
    CONTATO: 0,
    SIG_ATENDIMENTO: 0,
    SIG_PROBLEMA: 0,
    TREINAMENTO: 0,
  };

  const registrosComQuebra = new Set<string>();

  for (const r of registros) {
    const secNome = r.departamentoSigla || r.departamento || 'Não Identificada';
    const setorNome = r.setorSigla || r.setor || 'Setor Não Definido';
    const compResumo = r.competencia ? r.competencia.slice(0, 70) + (r.competencia.length > 70 ? '...' : '') : 'Vazia';

    // 1. Secretaria Oficial
    if (!r.departamento && !r.departamentoSigla) {
      const q: QuebraRegra = {
        id: `q-${r.id}-sec`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'SECRETARIA',
        gravidade: 'alta',
        titulo: 'Secretaria / Departamento não informado',
        descricao: 'O registro não possui secretaria ou departamento municipal vinculado.',
        sugestaoAjuste: 'Vincular a uma secretaria oficial de Porto Velho (ex: SEMUR, SEMFAZ).',
      };
      quebras.push(q);
      quebrasPorGravidade.alta++;
      quebrasPorTipo.SECRETARIA++;
      registrosComQuebra.add(r.id);
    } else if (!pertenceASecretariaOficial(r.departamento, r.departamentoSigla)) {
      const q: QuebraRegra = {
        id: `q-${r.id}-sec-desc`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'SECRETARIA',
        gravidade: 'alta',
        titulo: 'Secretaria fora do organograma oficial',
        descricao: `A lotação '${secNome}' não corresponde a uma secretaria reconhecida no organograma municipal.`,
        sugestaoAjuste: 'Corrigir sigla ou nome da secretaria oficial.',
      };
      quebras.push(q);
      quebrasPorGravidade.alta++;
      quebrasPorTipo.SECRETARIA++;
      registrosComQuebra.add(r.id);
    }

    // 2. Setor e Responsável
    const resp = (r.responsavel || '').trim();
    if (!resp || resp === 'Gerente do Setor' || resp === 'Diretor Responsável' || resp.length < 3) {
      const q: QuebraRegra = {
        id: `q-${r.id}-resp`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'RESPONSAVEL',
        gravidade: 'media',
        titulo: 'Chefia ou responsável não individualizado',
        descricao: `O setor '${setorNome}' não possui o nome formal do responsável cadastrado no diagnóstico.`,
        sugestaoAjuste: 'Informar o nome e cargo do responsável titular ou interino do setor.',
      };
      quebras.push(q);
      quebrasPorGravidade.media++;
      quebrasPorTipo.RESPONSAVEL++;
      registrosComQuebra.add(r.id);
    }

    // 3. Competência Regimental
    const comp = (r.competencia || '').trim();
    if (!comp || comp.length < 6) {
      const q: QuebraRegra = {
        id: `q-${r.id}-comp`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'COMPETENCIA',
        gravidade: 'alta',
        titulo: 'Competência regimental em branco',
        descricao: 'A descrição da competência do setor está ausente ou com texto insuficiente.',
        sugestaoAjuste: 'Inserir a atribuição/competência conforme regimento interno da secretaria.',
      };
      quebras.push(q);
      quebrasPorGravidade.alta++;
      quebrasPorTipo.COMPETENCIA++;
      registrosComQuebra.add(r.id);
    }

    // 4. Contato Institucional Obrigatório
    const contato = r.contatoInstitucional;
    const temTelefone = Boolean(contato?.telefone && contato.telefone.trim().length >= 4);
    const temEmail = Boolean(contato?.email && contato.email.trim().length >= 5);
    if (!contato || (!temTelefone && !temEmail)) {
      const q: QuebraRegra = {
        id: `q-${r.id}-contato`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'CONTATO',
        gravidade: 'media',
        titulo: 'Contato institucional não aderido',
        descricao: `O setor '${setorNome}' não tem ramal, telefone ou e-mail oficial associado.`,
        sugestaoAjuste: 'Adicionar ramal telefônico ou e-mail institucional (@portovelho.ro.gov.br).',
      };
      quebras.push(q);
      quebrasPorGravidade.media++;
      quebrasPorTipo.CONTATO++;
      registrosComQuebra.add(r.id);
    }

    // 5. Coerência SIG - Atendimento
    if (r.sistemaAtende === true && !r.moduloSig && !r.comoAtende) {
      const q: QuebraRegra = {
        id: `q-${r.id}-sig-atende`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'SIG_ATENDIMENTO',
        gravidade: 'baixa',
        titulo: 'Módulo do SIG não especificado',
        descricao: 'Foi informado que o SIG atende à competência, mas nenhum módulo ou forma de atendimento foi descrita.',
        sugestaoAjuste: 'Indicar módulo do Geo 360 (ex: Cadastro Imobiliário, Infraestrutura).',
      };
      quebras.push(q);
      quebrasPorGravidade.baixa++;
      quebrasPorTipo.SIG_ATENDIMENTO++;
      registrosComQuebra.add(r.id);
    }

    // 6. Coerência SIG - Problema sem detalhe ou chamado
    if (r.temProblema === true && !r.detalheProblema && !r.temChamado) {
      const q: QuebraRegra = {
        id: `q-${r.id}-sig-prob`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'SIG_PROBLEMA',
        gravidade: 'media',
        titulo: 'Problema no SIG sem detalhe técnico',
        descricao: 'Consta impedimento no SIG para esta competência, mas não há detalhamento nem registro de chamado.',
        sugestaoAjuste: 'Descrever o erro ou registrar número do chamado aberto junto à equipe do DASI.',
      };
      quebras.push(q);
      quebrasPorGravidade.media++;
      quebrasPorTipo.SIG_PROBLEMA++;
      registrosComQuebra.add(r.id);
    }

    // 7. Treinamento para Acesso à Camada
    if (r.acessoCamadaConcedido === true && r.houveTreinamento === false) {
      const q: QuebraRegra = {
        id: `q-${r.id}-treinamento`,
        registroId: r.id,
        secretaria: secNome,
        setor: setorNome,
        competencia: compResumo,
        tipo: 'TREINAMENTO',
        gravidade: 'baixa',
        titulo: 'Acesso à camada sem treinamento',
        descricao: `Permissão de acesso à camada de geoprocessamento concedida sem registro de treinamento para o setor '${setorNome}'.`,
        sugestaoAjuste: 'Agendar treinamento com a gerência do DGEO ou justificar no termo de aceite.',
      };
      quebras.push(q);
      quebrasPorGravidade.baixa++;
      quebrasPorTipo.TREINAMENTO++;
      registrosComQuebra.add(r.id);
    }
  }

  const totalRegistros = registros.length;
  const totalComQuebra = registrosComQuebra.size;
  const totalConformes = Math.max(0, totalRegistros - totalComQuebra);
  const taxaConformidade = totalRegistros > 0 ? Math.round((totalConformes / totalRegistros) * 100) : 100;

  let statusGeral: 'conforme' | 'com_ressalvas' | 'critico' = 'conforme';
  if (quebrasPorGravidade.alta > 0) {
    statusGeral = 'critico';
  } else if (quebrasPorGravidade.media > 0 || quebrasPorGravidade.baixa > 0) {
    statusGeral = 'com_ressalvas';
  }

  return {
    totalRegistros,
    totalConformes,
    totalComQuebra,
    taxaConformidade,
    quebras,
    quebrasPorGravidade,
    quebrasPorTipo,
    statusGeral,
  };
}
