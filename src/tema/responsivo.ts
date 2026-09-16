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

/** Escala de texto escolhida pelo usuário (pinça na lista ou chips em Ajustes). */
export const ESCALA_TEXTO_PADRAO = 1;
export const ESCALA_TEXTO_MINIMA = 0.85;
export const ESCALA_TEXTO_MAXIMA = 1.6;
/**
 * A pinça é contínua, mas a escala é arredondada nestes degraus antes de virar
 * estado do React: sem isso cada frame do gesto invalidaria o cache de estilos
 * e re-renderizaria a lista inteira.
 */
export const PASSO_ESCALA_TEXTO = 0.05;

/**
 * 'worklet' porque a pinça chama isto de dentro do `.onChange()`, na UI thread
 * — sem a diretiva o Reanimated trata a referência como função remota.
 */
export const limitarEscalaTexto = (valor: number): number => {
  'worklet';
  const limitado = Math.min(ESCALA_TEXTO_MAXIMA, Math.max(ESCALA_TEXTO_MINIMA, valor));
  const emDegraus = Math.round(limitado / PASSO_ESCALA_TEXTO) * PASSO_ESCALA_TEXTO;
  // Duas casas: o degrau é 0,05 e o arredondamento acima devolve coisas como
  // 1.0500000000000003, que quebrariam a comparação com os presets de Ajustes.
  return Math.round(emDegraus * 100) / 100;
};

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
   * Multiplicador de texto escolhido pelo usuário. Só as folhas criadas com
   * `criarEstilosEscalaveis` (hoje a lista) o aplicam — o resto do app mantém
   * tamanho fixo.
   */
  escalaTexto: number;

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

export const calcularMetricas = (
  largura: number,
  altura: number,
  escalaTexto: number = ESCALA_TEXTO_PADRAO,
): Metricas => {
  const classe = classificar(largura);
  const paisagem = largura > altura;
  const compacta = classe === 'compacta';
  const expandida = classe === 'expandida' || classe === 'grande';
  const escala = limitarEscalaTexto(escalaTexto);

  return {
    // A escala entra na chave do cache de estilos: em degraus fixos, então o
    // número de folhas memorizadas continua pequeno.
    chave: `${classe}:${paisagem ? 'p' : 'r'}:${escala.toFixed(2)}`,
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
    escalaTexto: escala,
    fonteMaxDensa: compacta ? 1.15 : 1.3,
  };
};

/**
 * Assina as dimensões da janela e devolve as métricas. Chame isto UMA VEZ, no
 * provedor — os componentes consomem via `useMetricas()`.
 */
export const useMetricasDaJanela = (escalaTexto: number = ESCALA_TEXTO_PADRAO): Metricas => {
  const { width, height } = useWindowDimensions();
  return useMemo(() => calcularMetricas(width, height, escalaTexto), [width, height, escalaTexto]);
};
