import {
  camposDaLinha,
  caminhoDaLinha,
  filtrarLinhas,
  tituloDaLinha,
  type AbaPlanilha,
} from '../src/data/planilha';
import { abasPlanilha } from '../src/data/planilha.gerado';
import { calcularSituacao, registroEmBranco, type Registro } from '../src/data/registros';
import { registrosImportados } from '../src/data/registros.gerado';
import { montarMapa } from '../src/mapa/layout';

const aba: AbaPlanilha = {
  nome: 'Teste',
  colunas: ['Secretaria', 'Departamento', 'Setor', 'Total', 'Observação'],
  colunasLotacao: [0, 1, 2],
  linhas: [
    { linha: 2, valores: ['SEMUR', 'Departamento X', 'Divisão de Análise', '7', 'Ótimo'] },
    { linha: 3, valores: ['SEMFAZ', 'Departamento Y', '', '', ''] },
  ],
};

describe('planilha completa', () => {
  it('traz as 9 abas da pasta de trabalho, inclusive as de resumo', () => {
    expect(abasPlanilha.map((a) => a.nome)).toEqual([
      'SEMUR',
      'SEMFAZ',
      'SEMUSB',
      'SEMA',
      'SEMTRAN',
      'Estrutura interna',
      'diagnostico de adesão ao sistem',
      'Página6',
      'Avanço das Atividades',
    ]);
  });

  it('cada linha tem um valor por coluna', () => {
    abasPlanilha.forEach((a) =>
      a.linhas.forEach((linha) => expect(linha.valores).toHaveLength(a.colunas.length)),
    );
  });

  it('título é o nível mais específico da lotação, e o caminho os de cima', () => {
    expect(tituloDaLinha(aba, aba.linhas[0])).toBe('Divisão de Análise');
    expect(caminhoDaLinha(aba, aba.linhas[0])).toBe('SEMUR › Departamento X');
    // Sem setor, o departamento vira o título.
    expect(tituloDaLinha(aba, aba.linhas[1])).toBe('Departamento Y');
  });

  it('campos da linha deixam a lotação de fora e pulam células vazias', () => {
    expect(camposDaLinha(aba, aba.linhas[0])).toEqual([
      { coluna: 'Total', valor: '7' },
      { coluna: 'Observação', valor: 'Ótimo' },
    ]);
    expect(camposDaLinha(aba, aba.linhas[1])).toEqual([]);
  });

  it('busca ignora acento e maiúscula', () => {
    expect(filtrarLinhas(aba, 'otimo').map((l) => l.linha)).toEqual([2]);
    expect(filtrarLinhas(aba, '  ')).toHaveLength(2);
  });
});

describe('levantamento importado', () => {
  it('tem as cinco secretarias da planilha', () => {
    const secretarias = new Set(registrosImportados.map((r) => r.secretaria));
    expect([...secretarias].sort()).toEqual(['SEMA', 'SEMFAZ', 'SEMTRAN', 'SEMUR', 'SEMUSB']);
  });

  it('ids são únicos (as edições locais se apoiam neles)', () => {
    const ids = registrosImportados.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('competência sem resposta não aparece como "parcial"', () => {
    const registro = { ...registroEmBranco(), id: 'x', competencia: 'I' } as Registro;
    expect(calcularSituacao(registro)).toBe('semResposta');
    expect(calcularSituacao({ ...registro, sistemaAtende: true })).toBe('parcial');
    expect(calcularSituacao({ ...registro, sistemaAtende: false })).toBe('pendente');
  });
});

describe('mapa mental com secretarias', () => {
  it('fechado mostra só a raiz e as secretarias', () => {
    const { nos } = montarMapa(registrosImportados, new Set());
    expect(nos.filter((no) => no.tipo === 'secretaria')).toHaveLength(5);
    expect(nos.some((no) => no.tipo === 'setor')).toBe(false);
  });

  it('abrir uma secretaria mostra os setores dela, e abrir o setor as competências', () => {
    const { nos: comSetores } = montarMapa(registrosImportados, new Set(['sec:SEMUR']));
    const setores = comSetores.filter((no) => no.tipo === 'setor');
    expect(setores.length).toBeGreaterThan(0);
    expect(setores.every((no) => no.paiId === 'sec-SEMUR')).toBe(true);

    const chaveDici = setores.find((no) => no.rotulo === 'DICI')?.chave ?? '';
    const { nos: comCompetencias } = montarMapa(
      registrosImportados,
      new Set(['sec:SEMUR', chaveDici]),
    );
    const competencias = comCompetencias.filter((no) => no.tipo === 'competencia');
    expect(competencias.length).toBeGreaterThan(0);
    expect(competencias.every((no) => no.registro?.setorSigla === 'DICI')).toBe(true);
  });
});
