import { validarRegrasPlanilha } from '../src/data/validadorRegrasExcel';
import { parseCSVouTSV } from '../src/data/importadorPlanilha';
import type { Registro } from '../src/data/registros';

describe('validadorRegrasExcel', () => {
  const registroValido: Registro = {
    id: 'reg-01',
    departamento: 'Secretaria Municipal de Regularização Fundiária - SEMUR',
    departamentoSigla: 'SEMUR',
    departamentoResponsavel: 'Secretário Municipal',
    departamentoCargo: 'Secretário',
    setor: 'Divisão de Geoprocessamento - DGEO',
    setorSigla: 'DGEO',
    responsavel: 'DASI - Administrador de Dados',
    cargo: 'Analista de TI',
    competencia: 'Elaboração e manutenção da base cartográfica municipal Geo 360',
    sistemaAtende: true,
    comoAtende: 'Módulo de cadastro e camadas espaciais',
    moduloSig: 'Cadastro Imobiliário',
    estruturadoNoSistema: true,
    houveTreinamento: true,
    informacoesAcessadas: 'Lotes e Quadras',
    nivelAcessoCamada: 'Edição',
    acessoCamadaConcedido: true,
    iniciouAtividade: true,
    nivelAcessoModulo: 'Administrador',
    acessoModuloConcedido: true,
    temProblema: false,
    temChamado: false,
    detalheProblema: '',
    observacao: '',
    contatoInstitucional: {
      telefone: '(69) 3901-3180',
      email: 'drcf.semur@portovelho.ro.gov.br',
    },
  };

  it('deve aprovar registro totalmente em conformidade', () => {
    const relatorio = validarRegrasPlanilha([registroValido]);
    expect(relatorio.totalRegistros).toBe(1);
    expect(relatorio.totalConformes).toBe(1);
    expect(relatorio.totalComQuebra).toBe(0);
    expect(relatorio.taxaConformidade).toBe(100);
    expect(relatorio.statusGeral).toBe('conforme');
    expect(relatorio.quebras).toHaveLength(0);
  });

  it('deve detectar quebra de regra quando secretaria não for identificada', () => {
    const registroInvalido = {
      ...registroValido,
      departamento: 'Empresa Privada de Consultoria',
      departamentoSigla: 'XYZ',
    };
    const relatorio = validarRegrasPlanilha([registroInvalido]);
    expect(relatorio.totalComQuebra).toBe(1);
    expect(relatorio.quebrasPorTipo.SECRETARIA).toBe(1);
    expect(relatorio.statusGeral).toBe('critico');
  });

  it('deve detectar quebra de regra quando contato institucional não for aderido', () => {
    const registroSemContato = {
      ...registroValido,
      contatoInstitucional: undefined,
    };
    const relatorio = validarRegrasPlanilha([registroSemContato]);
    expect(relatorio.totalComQuebra).toBe(1);
    expect(relatorio.quebrasPorTipo.CONTATO).toBe(1);
    expect(relatorio.quebras.some((q) => q.tipo === 'CONTATO')).toBe(true);
  });

  it('deve detectar acesso concedido à camada sem treinamento', () => {
    const registroSemTreinamento = {
      ...registroValido,
      acessoCamadaConcedido: true,
      houveTreinamento: false,
    };
    const relatorio = validarRegrasPlanilha([registroSemTreinamento]);
    expect(relatorio.quebrasPorTipo.TREINAMENTO).toBe(1);
    expect(relatorio.statusGeral).toBe('com_ressalvas');
  });
});

describe('importadorPlanilha (CSV/TSV)', () => {
  it('deve converter CSV com cabeçalhos oficiais em Registros estruturados', () => {
    const csv = `Departamento,Setor,Competência,1 O sistema atende,Módulo do SIG,Telefone,E-mail
SEMUR,Divisão de Geoprocessamento - DGEO (Gerente Damaris),Mapear áreas públicas,Sim,Geo 360,(69) 3901-3180,dgeo@portovelho.ro.gov.br`;

    const registros = parseCSVouTSV(csv);
    expect(registros).toHaveLength(1);
    expect(registros[0].departamento).toBe('SEMUR');
    expect(registros[0].setorSigla).toBe('DGEO');
    expect(registros[0].responsavel).toBe('Damaris');
    expect(registros[0].cargo).toBe('Gerente');
    expect(registros[0].sistemaAtende).toBe(true);
    expect(registros[0].contatoInstitucional?.telefone).toBe('(69) 3901-3180');
  });
});
