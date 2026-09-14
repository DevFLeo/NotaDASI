import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Métricas de layout derivadas do tamanho da janela.
 *
 * A ideia é a mesma dos "window size classes" do Material 3: em vez de cada
 * tela decidir sozinha o que é "tela pequena" (hoje o App usa 360, Ajustes usa
 * 400, e o resto não usa nada), existe UM lugar que classifica a janela e todo
 * componente pergunta a ele. Assim o app responde igual em celular estreito,
 * celular em pé, celular deitado e tablet.
 *
 * Use sempre via `useMetricas()` (ThemeContext) — o valor é calculado uma vez
 * por mudança de janela e compartilhado, em vez de cada componente assinar
 * `useWindowDimensions` por conta própria.
 */

/** Abaixo disto é celular estreito: rótulos curtos, espaçamento apertado. */
export const LIMITE_COMPACTA = 360;
/** A partir daqui cabe mais de uma coluna (tablet, ou celular deitado). */
export const LIMITE_EXPANDIDA = 600;
/** A partir daqui cabem três colunas (tablet grande deitado). */
export const LIMITE_GRANDE = 960;

export type ClasseLargura = 'compacta' | 'media' | 'expandida' | 'grande';

export type Metricas = {
  /**
   * Identidade do layout atual. Só muda quando algo que afeta os estilos muda
   * — é a chave do cache de StyleSheet em `estilos.ts`, por isso NÃO pode
   * conter a largura exata (senão cada pixel de rotação criaria um estilo).
   */
  chave: string;

  largura: number;
  altura: number;
  paisagem: boolean;

  classe: ClasseLargura;
  /** Celular estreito (<360dp). */
  compacta: boolean;
  /** Cabe layout de duas ou mais colunas (>=600dp). */
  expandida: boolean;

  /** Colunas da lista de competências. */
  colunas: number;
  /** Margem lateral do conteúdo. */
  margem: number;
  /** Espaçamento base entre blocos. */
  espaco: number;
  /** Largura máxima de uma coluna de leitura — evita linhas gigantes no tablet. */
  larguraMaxConteudo: number;
  /** Largura máxima de um painel modal; em telas largas ele deixa de ocupar tudo. */
  larguraMaxModal: number;
  /** Altura máxima (fração) de um painel modal — em paisagem sobra pouca altura. */
  alturaMaxModal: `${number}%`;

  /**
   * Teto para o multiplicador de fonte do sistema, aplicado nos textos densos
   * (abas, selos, indicadores). Sem isto, acessibilidade em "fonte enorme"
   * estoura os chips e a barra de abas.
   */
  fonteMaxDensa: number;
};

const classificar = (largura: number): ClasseLargura => {
  if (largura < LIMITE_COMPACTA) return 'compacta';
  if (largura < LIMITE_EXPANDIDA) return 'media';
  if (largura < LIMITE_GRANDE) return 'expandida';
  return 'grande';
};

const colunasPara = (classe: ClasseLargura): number => {
  if (classe === 'grande') return 3;
  if (classe === 'expandida') return 2;
  return 1;
};

export const calcularMetricas = (largura: number, altura: number): Metricas => {
  const classe = classificar(largura);
  const paisagem = largura > altura;
  const compacta = classe === 'compacta';
  const expandida = classe === 'expandida' || classe === 'grande';

  return {
    chave: `${classe}:${paisagem ? 'p' : 'r'}`,
    largura,
    altura,
    paisagem,
    classe,
    compacta,
    expandida,
    colunas: colunasPara(classe),
    margem: compacta ? 14 : expandida ? 24 : 18,
    espaco: compacta ? 10 : 14,
    larguraMaxConteudo: 760,
    larguraMaxModal: expandida ? 640 : largura,
    // Em paisagem a janela é baixa: o painel precisa de quase toda a altura
    // para ainda mostrar conteúdo acima do rodapé de botões.
    alturaMaxModal: paisagem ? '96%' : '88%',
    fonteMaxDensa: compacta ? 1.15 : 1.3,
  };
};

/**
 * Assina as dimensões da janela e devolve as métricas. Chame isto UMA VEZ, no
 * provedor — os componentes consomem via `useMetricas()`.
 */
export const useMetricasDaJanela = (): Metricas => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => calcularMetricas(width, height), [width, height]);
};
