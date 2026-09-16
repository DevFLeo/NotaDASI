import {
  requisitosFaltando,
  textoPesquisavelDaAnotacao,
  tituloDaAnotacao,
  valoresPreenchidos,
  type Anotacao,
  type Campo,
} from '../src/data/campos';
import { montarMapaDeAnotacoes } from '../src/mapa/layout';

const campo: Campo = {
  id: 'campo-1',
  nome: 'Contratos',
  tipo: 'livre',
  criadoEm: '2026-01-01T00:00:00.000Z',
  formulario: [
    { id: 'r1', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
    { id: 'r2', rotulo: 'Fornecedor', tipo: 'texto', obrigatorio: false },
    { id: 'r3', rotulo: 'Assinado', tipo: 'sim-nao', obrigatorio: false },
  ],
};

const anotacao = (valores: Anotacao['valores'], id = 'a1'): Anotacao => ({
  id,
  campoId: campo.id,
  valores,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
});

test('o primeiro requisito do formulário dá nome ao item', () => {
  expect(tituloDaAnotacao(campo, anotacao({ r1: 'Limpeza predial' }))).toBe('Limpeza predial');
  expect(tituloDaAnotacao(campo, anotacao({ r2: 'sem título aqui' }))).toBe('Sem título');
});

test('só os requisitos preenchidos aparecem, na ordem do formulário', () => {
  const preenchidos = valoresPreenchidos(campo, anotacao({ r1: 'Obra', r2: '', r3: true }));
  expect(preenchidos.map((item) => [item.requisito.id, item.texto])).toEqual([
    ['r1', 'Obra'],
    ['r3', 'Sim'],
  ]);
});

test('a busca enxerga rótulo e valor de todos os requisitos', () => {
  const texto = textoPesquisavelDaAnotacao(campo, anotacao({ r1: 'Obra', r3: false }));
  expect(texto).toContain('Fornecedor');
  expect(texto).toContain('Obra');
  expect(texto).toContain('Não');
});

test('requisito obrigatório em branco barra o salvamento', () => {
  expect(requisitosFaltando(campo, { r1: '  ' }).map((item) => item.id)).toEqual(['r1']);
  expect(requisitosFaltando(campo, { r1: 'Obra' })).toHaveLength(0);
});

test('o mapa de um campo livre é a raiz do cofre mais um nó por item', () => {
  const { nos, ligacoes } = montarMapaDeAnotacoes(campo, [
    anotacao({ r1: 'Obra', r2: 'Construtora' }, 'a1'),
    anotacao({ r1: 'Limpeza' }, 'a2'),
  ]);

  expect(nos).toHaveLength(3);
  // A raiz leva o id do campo: cofres diferentes não podem dividir a mesma
  // posição salva no mapa.
  expect(nos[0].id).toBe('raiz-campo-1');
  expect(nos[1].subtitulo).toBe('Fornecedor: Construtora');
  expect(nos.map((no) => no.tipo)).toEqual(['raiz', 'anotacao', 'anotacao']);
  expect(ligacoes.every((ligacao) => ligacao.origemId === 'raiz-campo-1')).toBe(true);
});
