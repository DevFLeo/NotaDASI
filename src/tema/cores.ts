/**
 * Paleta de cores por tema, em tokens semânticos.
 *
 * Nenhum componente deve usar um valor hex direto — sempre `tema.algumTom`,
 * assim os dois temas (e um terceiro no futuro) ficam garantidamente
 * consistentes. Ver `ThemeContext.tsx` para como o tema chega aos componentes.
 */

export type Tema = {
  modo: 'claro' | 'escuro';

  // Fundos
  fundo: string;
  fundoElevado: string;
  superficie: string;
  superficieAtiva: string;

  // Texto
  texto: string;
  textoSecundario: string;
  textoTerciario: string;
  textoInvertido: string;

  // Bordas e divisores
  borda: string;
  bordaForte: string;

  // Marca
  primaria: string;
  primariaFundo: string;
  primariaTexto: string;

  // Status (situação de adesão, indicadores, favoritos)
  sucesso: string;
  sucessoFundo: string;
  alerta: string;
  alertaFundo: string;
  erro: string;
  erroFundo: string;
  problema: string;
  problemaFundo: string;
  favorito: string;

  // Overlays (modais, backdrops)
  overlay: string;

  // Sombra
  sombra: string;
};

export const temaClaro: Tema = {
  modo: 'claro',

  fundo: '#f4f6fb',
  fundoElevado: '#ffffff',
  superficie: '#eef1f8',
  superficieAtiva: '#e2e8f5',

  texto: '#0f172a',
  textoSecundario: '#475569',
  textoTerciario: '#94a3b8',
  textoInvertido: '#f8fafc',

  borda: '#dde3ee',
  bordaForte: '#c7d0e0',

  primaria: '#2563eb',
  primariaFundo: 'rgba(37, 99, 235, 0.10)',
  primariaTexto: '#1d4ed8',

  sucesso: '#0f9d63',
  sucessoFundo: 'rgba(15, 157, 99, 0.12)',
  alerta: '#b45309',
  alertaFundo: 'rgba(180, 83, 9, 0.12)',
  erro: '#dc2626',
  erroFundo: 'rgba(220, 38, 38, 0.10)',
  problema: '#be185d',
  problemaFundo: 'rgba(190, 24, 93, 0.10)',
  favorito: '#d97706',

  overlay: 'rgba(15, 23, 42, 0.45)',
  sombra: 'rgba(15, 23, 42, 0.16)',
};

export const temaEscuro: Tema = {
  modo: 'escuro',

  fundo: '#07111f',
  fundoElevado: '#0b1220',
  superficie: 'rgba(148, 163, 184, 0.10)',
  superficieAtiva: 'rgba(37, 99, 235, 0.22)',

  texto: '#f8fafc',
  textoSecundario: '#94a3b8',
  textoTerciario: '#64748b',
  textoInvertido: '#0f172a',

  borda: 'rgba(148, 163, 184, 0.18)',
  bordaForte: 'rgba(148, 163, 184, 0.35)',

  primaria: '#2563eb',
  primariaFundo: 'rgba(37, 99, 235, 0.22)',
  primariaTexto: '#dbeafe',

  sucesso: '#6ee7b7',
  sucessoFundo: 'rgba(110, 231, 183, 0.16)',
  alerta: '#fcd34d',
  alertaFundo: 'rgba(252, 211, 77, 0.14)',
  erro: '#fca5a5',
  erroFundo: 'rgba(252, 165, 165, 0.12)',
  problema: '#f9a8d4',
  problemaFundo: 'rgba(249, 168, 212, 0.10)',
  favorito: '#fcd34d',

  overlay: 'rgba(2, 6, 23, 0.7)',
  sombra: 'rgba(0, 0, 0, 1)',
};
