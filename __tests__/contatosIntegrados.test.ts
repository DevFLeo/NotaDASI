import {
  combinarContatos,
  extrairContatosDoSig,
  textoPesquisavelContato,
  type ContatoIntegrado,
} from '../src/data/contatosIntegrados';
import { parseCSVouTSV } from '../src/data/importadorPlanilha';
import type { Registro } from '../src/data/registros';
import { montarMapaDeContatos } from '../src/mapa/layout';

const criarRegistroBase = (parcial: Partial<Registro>): Registro => ({
  id: 'reg-1',
  departamento: 'Secretaria Municipal de Regularização Fundiária',
  departamentoSigla: 'SEMUR',
  departamentoResponsavel: 'Diretoria Exemplo',
  departamentoCargo: 'Diretora',
  setor: 'Divisão de Controle e Informação',
  setorSigla: 'DICI',
  responsavel: 'Gerência Exemplo',
  cargo: 'Gerente',
  competencia: 'Competência 1',
  comoAtende: '',
  informacoesAcessadas: '',
  nivelAcessoCamada: '',
  moduloSig: '',
  nivelAcessoModulo: '',
  detalheProblema: '',
  observacao: '',
  ...parcial,
});

describe('contatosIntegrados', () => {
  it('extrai e consolida contatos do SIG sem duplicar setores com varias competencias', () => {
    const r1 = criarRegistroBase({
      id: 'r1',
      competencia: 'Competência A',
      contatoInstitucional: { email: 'dici@portovelho.ro.gov.br' },
    });
    const r2 = criarRegistroBase({
      id: 'r2',
      competencia: 'Competência B',
      contatoInstitucional: { telefone: '(69) 3901-1234', ramal: '205' },
    });
    const r3 = criarRegistroBase({
      id: 'r3',
      departamentoSigla: 'SEMA',
      setorSigla: 'DEFIS',
      setor: 'Divisão de Fiscalização',
      responsavel: 'Coordenação DEFIS',
      competencia: 'Competência C',
    });

    const contatos = extrairContatosDoSig([r1, r2, r3]);
    expect(contatos).toHaveLength(2);

    const semur = contatos.find((c) => c.secretaria === 'SEMUR');
    expect(semur).toBeDefined();
    expect(semur?.origem).toBe('sig');
    expect(semur?.email).toBe('dici@portovelho.ro.gov.br');
    expect(semur?.telefone).toBe('(69) 3901-1234');
    expect(semur?.ramal).toBe('205');
    expect(semur?.semContato).toBe(false);
    expect(semur?.competenciasVinculadas).toHaveLength(2);

    const sema = contatos.find((c) => c.secretaria === 'SEMA');
    expect(sema?.semContato).toBe(true);
    expect(sema?.competenciasVinculadas).toHaveLength(1);
  });

  it('combina contatos do SIG com contatos manuais ordenados por secretaria', () => {
    const r1 = criarRegistroBase({ id: 'r1', departamentoSigla: 'SEMUR' });
    const manual: ContatoIntegrado = {
      id: 'manual-1',
      origem: 'manual',
      nome: 'Suporte DASI',
      cargo: 'Analista',
      secretaria: 'DASI',
      departamento: 'DASI',
      setorSigla: 'TI',
      setor: 'Tecnologia',
      email: 'dasi@portovelho.ro.gov.br',
      competenciasVinculadas: [],
      semContato: false,
    };

    const todos = combinarContatos([r1], [manual]);
    expect(todos).toHaveLength(2);
    expect(todos[0].secretaria).toBe('DASI');
    expect(todos[1].secretaria).toBe('SEMUR');
    expect(textoPesquisavelContato(todos[0])).toContain('dasi@portovelho.ro.gov.br');
  });

  it('integra automaticamente contatos (telefone, ramal, email) vindos de planilha Excel/CSV', () => {
    const csv = [
      'Secretaria;Setor;Competência;Telefone;Ramal;Email',
      'SEMFAZ;Divisão de Tributos - DITRI (Gerente Carlos);Emitir certidão;(69) 3901-3038;412;ditri@portovelho.ro.gov.br',
    ].join('\n');

    const importados = parseCSVouTSV(csv);
    expect(importados).toHaveLength(1);
    expect(importados[0].contatoInstitucional).toEqual({
      telefone: '(69) 3901-3038',
      email: 'ditri@portovelho.ro.gov.br',
      ramal: '412',
    });

    const contatos = extrairContatosDoSig(importados);
    expect(contatos).toHaveLength(1);
    expect(contatos[0].telefone).toBe('(69) 3901-3038');
    expect(contatos[0].ramal).toBe('412');
    expect(contatos[0].email).toBe('ditri@portovelho.ro.gov.br');
    expect(contatos[0].semContato).toBe(false);
  });

  it('monta mapa mental de contatos em 3 niveis (Secretaria -> Setor -> Nome)', () => {
    const contatos = extrairContatosDoSig([
      criarRegistroBase({
        id: 'r1',
        departamentoSigla: 'SEMFAZ',
        setorSigla: 'DCIM',
        responsavel: 'Nilson',
        cargo: 'Gerente',
        contatoInstitucional: { telefone: '(69) 3901-3038' },
      }),
    ]);

    // Nível 1: só Secretarias
    const nivel1 = montarMapaDeContatos(contatos, new Set());
    expect(nivel1.nos.map((n) => n.rotulo)).toEqual(['SEMFAZ']);

    // Nível 2: Secretaria expandida -> Setor
    const nivel2 = montarMapaDeContatos(contatos, new Set(['SEMFAZ']));
    expect(nivel2.nos.map((n) => n.rotulo)).toEqual(['SEMFAZ', 'DCIM']);

    // Nível 3: Setor expandido -> Nome do contato
    const nivel3 = montarMapaDeContatos(contatos, new Set(['SEMFAZ', 'DCIM']));
    const noContato = nivel3.nos.find((n) => n.tipo === 'contato');
    expect(noContato?.rotulo).toBe('Nilson');
    expect(noContato?.contato?.telefone).toBe('(69) 3901-3038');
  });
});
