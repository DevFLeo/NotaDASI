/**
 * Modelo do levantamento de competências e adesão ao SIG
 * (Prefeitura de Porto Velho).
 *
 * Cada registro é UMA COMPETÊNCIA de um setor, com as respostas sobre como o
 * SIG atende (ou não) aquela atividade.
 *
 * IMPORTANTE: estes campos espelham exatamente a dataclass `Registro` de
 * scripts/importacao_de_xlsx.py. Ao mudar um lado, mude o outro.
 */

export type Contato = {
  email?: string;
  telefone?: string;
  ramal?: string;
};

export type Registro = {
  id: string;

  // Lotação
  departamento: string;
  departamentoSigla: string;
  departamentoResponsavel: string;
  departamentoCargo: string;

  setor: string;
  setorSigla: string;
  responsavel: string;
  cargo: string;

  // Competência avaliada
  competencia: string;

  // Respostas sobre o SIG (undefined = não respondido / "-")
  sistemaAtende?: boolean;
  comoAtende: string;
  estruturadoNoSistema?: boolean;
  houveTreinamento?: boolean;

  informacoesAcessadas: string;
  nivelAcessoCamada: string;
  acessoCamadaConcedido?: boolean;
  iniciouAtividade?: boolean;

  moduloSig: string;
  nivelAcessoModulo: string;
  acessoModuloConcedido?: boolean;

  temProblema?: boolean;
  temChamado?: boolean;
  detalheProblema: string;
  observacao: string;

  contatoInstitucional?: Contato;
  contatoPessoal?: Contato;
};

/** Situação derivada das respostas — usada para colorir o cartão. */
export type SituacaoAdesao = 'aderido' | 'parcial' | 'pendente' | 'problema';

export const rotuloSituacao: Record<SituacaoAdesao, string> = {
  aderido: 'Aderido',
  parcial: 'Parcial',
  pendente: 'Pendente',
  problema: 'Com problema',
};

export const corPorSituacao: Record<SituacaoAdesao, string> = {
  aderido: '#6EE7B7',
  parcial: '#FCD34D',
  pendente: '#FCA5A5',
  problema: '#F9A8D4',
};

/**
 * Resume a linha em um status único:
 * - problema : há problema relatado no SIG
 * - pendente : o sistema não atende a competência
 * - aderido  : atende E já iniciou a atividade no sistema
 * - parcial  : atende, mas ainda não começou a usar
 */
export const calcularSituacao = (registro: Registro): SituacaoAdesao => {
  if (registro.temProblema === true) {
    return 'problema';
  }
  if (registro.sistemaAtende === false) {
    return 'pendente';
  }
  if (registro.sistemaAtende === true && registro.iniciouAtividade === true) {
    return 'aderido';
  }
  return 'parcial';
};

/** Texto varrido pela busca: setor, responsável, cargo, competência e módulo. */
export const textoPesquisavel = (registro: Registro): string =>
  [
    registro.responsavel,
    registro.cargo,
    registro.setor,
    registro.setorSigla,
    registro.departamento,
    registro.departamentoSigla,
    registro.departamentoResponsavel,
    registro.competencia,
    registro.moduloSig,
    registro.informacoesAcessadas,
    registro.observacao,
  ].join(' ');

/**
 * Dados de exemplo (fictícios) no formato do levantamento real.
 * Substitua rodando:
 *   python scripts/importacao_de_xlsx.py sua_planilha.xlsx --ts src/data/registros.gerado.ts
 */
export const registrosExemplo: Registro[] = [
  {
    id: 'lev-0002',
    departamento: 'Departamento de Regularização e Cadastro Fundiário',
    departamentoSigla: 'DRCF',
    departamentoResponsavel: 'Geisa Pacheco de Souza Monteiro',
    departamentoCargo: 'Diretora',
    setor: 'Divisão de Controle e Informação',
    setorSigla: 'DICI',
    responsavel: 'Damaris Loddoggi Dias Galvão',
    cargo: 'Gerente',
    competencia:
      'I – instruir informação relativa à localização do imóvel, inscrição cadastral e outra necessária ao atendimento dos processos;',
    sistemaAtende: true,
    comoAtende:
      'Gerar o Boletim de Complemento Cadastral - BCC usando informações da camada de lotes;',
    estruturadoNoSistema: true,
    houveTreinamento: true,
    informacoesAcessadas: 'Lotes',
    nivelAcessoCamada: 'Edição',
    acessoCamadaConcedido: true,
    iniciouAtividade: true,
    moduloSig: 'Cadastro Imobiliário padrão',
    nivelAcessoModulo: 'Leitor',
    acessoModuloConcedido: true,
    temProblema: false,
    temChamado: false,
    detalheProblema: '',
    observacao: '',
  },
  {
    id: 'lev-0003',
    departamento: 'Departamento de Regularização e Cadastro Fundiário',
    departamentoSigla: 'DRCF',
    departamentoResponsavel: 'Geisa Pacheco de Souza Monteiro',
    departamentoCargo: 'Diretora',
    setor: 'Divisão de Controle e Informação',
    setorSigla: 'DICI',
    responsavel: 'Damaris Loddoggi Dias Galvão',
    cargo: 'Gerente',
    competencia:
      'II – manter atualizada a informação das áreas não edificadas, subutilizadas ou não utilizadas para fins do parcelamento compulsório;',
    sistemaAtende: true,
    comoAtende: 'Inserindo informações e atualizando a geometria na camada de vazios urbanos',
    estruturadoNoSistema: true,
    houveTreinamento: false,
    informacoesAcessadas: 'Vazios Urbanos',
    nivelAcessoCamada: 'Edição',
    acessoCamadaConcedido: false,
    iniciouAtividade: false,
    moduloSig: 'Cadastro Imobiliário padrão',
    nivelAcessoModulo: 'Leitor',
    acessoModuloConcedido: true,
    temProblema: false,
    temChamado: false,
    detalheProblema: '',
    observacao: '',
  },
  {
    id: 'lev-0004',
    departamento: 'Departamento de Regularização e Cadastro Fundiário',
    departamentoSigla: 'DRCF',
    departamentoResponsavel: 'Geisa Pacheco de Souza Monteiro',
    departamentoCargo: 'Diretora',
    setor: 'Divisão de Controle e Informação',
    setorSigla: 'DICI',
    responsavel: 'Damaris Loddoggi Dias Galvão',
    cargo: 'Gerente',
    competencia:
      'IV – expedição de croqui de localização e mapa para fins de instrução processual;',
    sistemaAtende: true,
    comoAtende: 'Gerar Mapa de Localização do Lote com enquadramento na quadra',
    estruturadoNoSistema: true,
    houveTreinamento: true,
    informacoesAcessadas: 'Lotes',
    nivelAcessoCamada: 'Edição',
    acessoCamadaConcedido: true,
    iniciouAtividade: true,
    moduloSig: 'Cadastro Imobiliário padrão',
    nivelAcessoModulo: 'Leitor',
    acessoModuloConcedido: true,
    temProblema: false,
    temChamado: false,
    detalheProblema: '',
    observacao: '',
  },
  {
    id: 'lev-0005',
    departamento: 'Departamento de Regularização e Cadastro Fundiário',
    departamentoSigla: 'DRCF',
    departamentoResponsavel: 'Geisa Pacheco de Souza Monteiro',
    departamentoCargo: 'Diretora',
    setor: 'Divisão de Certidão e Taxa Fundiária',
    setorSigla: 'DICTF',
    responsavel: 'Cleicione Rodrigues de Lima',
    cargo: 'Gerente',
    competencia: 'I – Manter registro da extinção do Direito de Superfície;',
    sistemaAtende: false,
    comoAtende: '',
    estruturadoNoSistema: false,
    houveTreinamento: false,
    informacoesAcessadas: 'Nenhuma',
    nivelAcessoCamada: '',
    acessoCamadaConcedido: false,
    iniciouAtividade: false,
    moduloSig: 'Cadastro Imobiliário padrão',
    nivelAcessoModulo: 'Leitor',
    acessoModuloConcedido: false,
    temProblema: false,
    temChamado: false,
    detalheProblema: '',
    observacao: 'planilha para controle processual',
  },
  {
    id: 'lev-0006',
    departamento: 'Departamento de Regularização e Cadastro Fundiário',
    departamentoSigla: 'DRCF',
    departamentoResponsavel: 'Geisa Pacheco de Souza Monteiro',
    departamentoCargo: 'Diretora',
    setor: 'Divisão de Certidão e Taxa Fundiária',
    setorSigla: 'DICTF',
    responsavel: 'Cleicione Rodrigues de Lima',
    cargo: 'Gerente',
    competencia:
      'VI – Manter atualizado o registro de lotes oferecidos ou de escritura plena e principalmente no que se refere à cessão dominial;',
    sistemaAtende: true,
    comoAtende:
      'Informar na Camada de Lotes se o lote é aforado: sim ou não seja por meio de processo ou por consulta a camada de cartas de aforamento',
    estruturadoNoSistema: true,
    houveTreinamento: false,
    informacoesAcessadas: 'Lotes',
    nivelAcessoCamada: 'Edição',
    acessoCamadaConcedido: false,
    iniciouAtividade: false,
    moduloSig: 'Cadastro Imobiliário padrão',
    nivelAcessoModulo: 'Leitor',
    acessoModuloConcedido: false,
    temProblema: true,
    temChamado: false,
    detalheProblema: 'Camada de cartas de aforamento sem os PDFs anexados',
    observacao:
      'Competência já realizada pelo DICI/DRCF no ato de gerar o BCC; o setor acabou não inserindo essa informação mesmo podendo fazer',
  },
];
