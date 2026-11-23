import {
  COLUNAS_KANBAN,
  calcularColunaKanbanAutomatica,
  calcularUrgencia,
  normalizarNumeroSei,
  obterColunaKanban,
} from '../src/data/kanban';
import {
  registroEmBranco,
  registrosExemplo,
  textoPesquisavel,
  type Registro,
} from '../src/data/registros';

const criarRegistro = (parcial: Partial<Registro> = {}): Registro => ({
  id: 'teste-1',
  ...registroEmBranco(),
  departamento: 'Departamento Teste',
  departamentoSigla: 'DT',
  setor: 'Setor Teste',
  setorSigla: 'ST',
  competencia: 'Competência de teste',
  ...parcial,
});

describe('Kanban e cálculo de urgência', () => {
  test('define as 5 colunas esperadas (Não iniciado, Em processo, Urgência, Revisão, Concluído)', () => {
    expect(COLUNAS_KANBAN.map((c) => c.id)).toEqual([
      'nao_iniciado',
      'em_processo',
      'urgencia',
      'revisao',
      'concluido',
    ]);
  });

  test('registro em branco (sem respostas) vai para Não iniciado com 0 pontos', () => {
    const r = criarRegistro();
    const urgencia = calcularUrgencia(r);

    expect(urgencia.pontuacao).toBe(0);
    expect(urgencia.eUrgente).toBe(false);
    expect(urgencia.nivel).toBe('nenhuma');
    expect(calcularColunaKanbanAutomatica(r)).toBe('nao_iniciado');
  });

  test('registro totalmente aderido e sem problemas vai para Concluído', () => {
    const aderido = registrosExemplo[0]; // lev-0002
    const urgencia = calcularUrgencia(aderido);

    expect(urgencia.pontuacao).toBe(0);
    expect(urgencia.eUrgente).toBe(false);
    expect(calcularColunaKanbanAutomatica(aderido)).toBe('concluido');
  });

  test('registro atendido com progresso parcial e poucas pendências vai para Em processo', () => {
    const parcial = registrosExemplo[1]; // lev-0003 (3 pontos: treinado=false, acessoCamada=false, iniciou=false)
    const urgencia = calcularUrgencia(parcial);

    expect(urgencia.pontuacao).toBe(3);
    expect(urgencia.eUrgente).toBe(false);
    expect(urgencia.nivel).toBe('atencao');
    expect(calcularColunaKanbanAutomatica(parcial)).toBe('em_processo');
  });

  test('registro com sistemaAtende=false e estruturadoNoSistema=false entra em Urgência', () => {
    const pendente = registrosExemplo[3]; // lev-0005
    const urgencia = calcularUrgencia(pendente);

    expect(urgencia.eUrgente).toBe(true);
    expect(urgencia.pontuacao).toBeGreaterThanOrEqual(7);
    expect(urgencia.nivel).toBe('critica');
    expect(urgencia.fatores.map((f) => f.codigo)).toEqual(
      expect.arrayContaining(['NAO_ATENDE', 'NAO_ESTRUTURADO', 'TREINAMENTO_PENDENTE']),
    );
    expect(calcularColunaKanbanAutomatica(pendente)).toBe('urgencia');
  });

  test('registro com problema relatado e sem chamado aberto entra em Urgência', () => {
    const comProblema = registrosExemplo[4]; // lev-0006
    const urgencia = calcularUrgencia(comProblema);

    expect(urgencia.eUrgente).toBe(true);
    expect(urgencia.fatores.map((f) => f.codigo)).toEqual(
      expect.arrayContaining(['PROBLEMA_SIG', 'SEM_CHAMADO']),
    );
    expect(calcularColunaKanbanAutomatica(comProblema)).toBe('urgencia');
  });

  test('acúmulo de respostas "Não" (pontuação >= 4) leva automaticamente para Urgência', () => {
    const acumulado = criarRegistro({
      sistemaAtende: true,
      estruturadoNoSistema: false, // +2
      houveTreinamento: false, // +1
      acessoCamadaConcedido: false, // +1
      iniciouAtividade: false, // +1
    });

    const urgencia = calcularUrgencia(acumulado);
    expect(urgencia.pontuacao).toBe(5);
    expect(urgencia.eUrgente).toBe(true);
    expect(calcularColunaKanbanAutomatica(acumulado)).toBe('urgencia');
  });

  test('obterColunaKanban respeita decisão manual / parecer (Concluído ou Revisão) e volta ao automático quando limpo', () => {
    const urgente = registrosExemplo[3];
    expect(obterColunaKanban(urgente)).toBe('urgencia');

    const emRevisao: Registro = {
      ...urgente,
      kanban: {
        colunaManual: 'revisao',
        responsavelContinuidade: 'Gerência DICI',
      },
    };
    expect(obterColunaKanban(emRevisao)).toBe('revisao');

    const concluidoPorParecer: Registro = {
      ...urgente,
      kanban: {
        colunaManual: 'concluido',
      },
    };
    expect(obterColunaKanban(concluidoPorParecer)).toBe('concluido');

    const automaticoRestaurado: Registro = {
      ...urgente,
      kanban: {
        colunaManual: undefined,
      },
    };
    expect(obterColunaKanban(automaticoRestaurado)).toBe('urgencia');
  });
});

describe('Número do SEI opcional e busca', () => {
  test('normalizarNumeroSei trata vazio/espaços como undefined (não obrigatório)', () => {
    expect(normalizarNumeroSei(undefined)).toBeUndefined();
    expect(normalizarNumeroSei('')).toBeUndefined();
    expect(normalizarNumeroSei('   ')).toBeUndefined();
    expect(normalizarNumeroSei('  00600-00012345/2026-01  ')).toBe('00600-00012345/2026-01');
  });

  test('textoPesquisavel inclui número do SEI do card, dos comentários e responsável pela continuidade', () => {
    const r = criarRegistro({
      numeroSei: '00600-00012345/2026-01',
      kanban: {
        colunaManual: 'revisao',
        responsavelContinuidade: 'Coordenação DGEO',
      },
      comentarios: [
        {
          id: 'c-1',
          dataHora: '2026-11-23T10:00:00.000Z',
          usuario: 'dasi',
          nome: 'DASI',
          papel: 'dasi',
          texto: 'Encaminhado para verificação',
          numeroSei: '00600-00099999/2026-88',
        },
      ],
    });

    const texto = textoPesquisavel(r);
    expect(texto).toContain('00600-00012345/2026-01');
    expect(texto).toContain('00600-00099999/2026-88');
    expect(texto).toContain('Coordenação DGEO');
  });
});
