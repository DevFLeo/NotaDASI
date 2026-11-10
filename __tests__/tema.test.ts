import { temaClaro, temaEscuro, type Tema } from '../src/tema/cores';
import { coresDaSituacao } from '../src/tema/situacao';

/** Luminância relativa e contraste do WCAG 2.1, para cores `#rrggbb`. */
const luminancia = (hex: string): number => {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contraste = (a: string, b: string): number => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};

const situacoes = ['aderido', 'parcial', 'pendente', 'problema'] as const;

describe.each<[string, Tema]>([
  ['claro', temaClaro],
  ['escuro', temaEscuro],
])('tema %s', (_nome, tema) => {
  it.each(situacoes)('o selo "%s" é legível sobre o cartão (AA, 4.5:1)', (situacao) => {
    const { cor } = coresDaSituacao(tema, situacao);
    expect(contraste(cor, tema.fundoElevado)).toBeGreaterThanOrEqual(4.5);
  });

  it('o texto terciário é legível sobre o cartão e sobre o fundo (AA)', () => {
    expect(contraste(tema.textoTerciario, tema.fundoElevado)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(tema.textoTerciario, tema.fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it('o texto sobre a cor primária é legível (AA)', () => {
    expect(contraste(tema.sobrePrimaria, tema.primaria)).toBeGreaterThanOrEqual(4.5);
  });
});
