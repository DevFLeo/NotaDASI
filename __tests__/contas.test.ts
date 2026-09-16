import {
  CONTAS_PADRAO,
  acharConta,
  hashSenha,
  normalizarUsuario,
  reconciliarContas,
  senhaConfere,
  type Conta,
} from '../src/auth/contas';

describe('normalizarUsuario', () => {
  it('ignora caixa, acento, hífen e espaço extra', () => {
    // Ninguém digita "GERENTE - DGEO" com o espaçamento exato: as quatro
    // formas abaixo precisam cair na mesma conta.
    expect(normalizarUsuario('GERENTE - DGEO')).toBe('GERENTE DGEO');
    expect(normalizarUsuario('gerente-dgeo')).toBe('GERENTE DGEO');
    expect(normalizarUsuario('  Gerente   DGEO  ')).toBe('GERENTE DGEO');
    expect(normalizarUsuario('Secretário')).toBe('SECRETARIO');
  });
});

describe('hashSenha', () => {
  it('é determinístico e não devolve a senha em texto', () => {
    expect(hashSenha('dasi')).toBe(hashSenha('dasi'));
    expect(hashSenha('dasi')).not.toContain('dasi');
    expect(hashSenha('dasi')).toHaveLength(16);
  });

  it('separa senhas diferentes', () => {
    expect(hashSenha('dasi')).not.toBe(hashSenha('dasi2'));
    expect(hashSenha('gerente')).not.toBe(hashSenha('secretario'));
  });
});

describe('contas padrão', () => {
  it('entra com a senha combinada de cada conta', () => {
    const casos: [string, string][] = [
      ['DASI', 'dasi'],
      ['GERENTE - DGEO', 'gerente'],
      ['SECRETARIO', 'secretario'],
    ];

    casos.forEach(([usuario, senha]) => {
      const conta = acharConta(CONTAS_PADRAO, usuario);
      expect(conta).toBeDefined();
      expect(senhaConfere(conta as Conta, senha)).toBe(true);
      expect(senhaConfere(conta as Conta, 'errada')).toBe(false);
    });
  });

  it('as três existem', () => {
    expect(CONTAS_PADRAO.map((conta) => conta.nome)).toEqual([
      'DASI',
      'GERENTE - DGEO',
      'SECRETARIO',
    ]);
  });
});

describe('reconciliarContas', () => {
  it('recria as contas padrão quando o armazenamento está vazio', () => {
    expect(reconciliarContas([]).map((conta) => conta.usuario)).toEqual([
      'DASI',
      'GERENTE DGEO',
      'SECRETARIO',
    ]);
  });

  it('preserva a senha trocada de uma conta padrão', () => {
    const salvas: Conta[] = [{ ...CONTAS_PADRAO[0], senhaHash: hashSenha('nova') }];
    const conta = acharConta(reconciliarContas(salvas), 'DASI') as Conta;

    expect(senhaConfere(conta, 'nova')).toBe(true);
    expect(senhaConfere(conta, 'dasi')).toBe(false);
  });

  it('não deixa apagar uma conta padrão do armazenamento', () => {
    // Só a SECRETARIO foi salva; as outras duas precisam voltar, senão um
    // armazenamento limpo (ou de outra versão) trancaria todo mundo do lado de fora.
    const salvas: Conta[] = [CONTAS_PADRAO[2]];
    expect(reconciliarContas(salvas)).toHaveLength(3);
  });

  it('mantém contas não-padrão que existirem no armazenamento', () => {
    const extra: Conta = {
      usuario: 'ESTAGIARIO',
      nome: 'ESTAGIARIO',
      papel: 'outro',
      descricao: 'Conta criada fora do padrão',
      senhaHash: hashSenha('x'),
      padrao: false,
      criadaEm: '2026-01-01T00:00:00.000Z',
    };

    const resultado = reconciliarContas([extra]);
    expect(resultado).toHaveLength(4);
    expect(acharConta(resultado, 'estagiario')).toBeDefined();
  });
});
