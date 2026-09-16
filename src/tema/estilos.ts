import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { Tema } from './cores';
import type { Metricas } from './responsivo';

type Estilos = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Fábrica de estilos com cache por (tema × layout).
 *
 * Antes, cada componente chamava `criarEstilos(tema)` direto no corpo do
 * render — e `StyleSheet.create` reconstruía o objeto inteiro toda vez. Em
 * lista isso multiplica: um cartão com quatro indicadores construía cinco
 * folhas de estilo por item, a cada tecla digitada na busca. Como as folhas só
 * dependem do tema e da classe de layout, dá para memorizar e devolver sempre
 * a mesma referência — o que também deixa o `React.memo` dos cartões funcionar.
 *
 * O cache é WeakMap para não segurar temas na memória, e o segundo nível é a
 * `chave` das métricas (ex.: "media:r"), que muda só quando o layout muda de
 * classe ou de orientação.
 */
export const criarEstilos = <T extends Estilos>(
  construir: (tema: Tema, metricas: Metricas) => T,
): ((tema: Tema, metricas: Metricas) => T) => {
  const cache = new WeakMap<Tema, Map<string, T>>();

  return (tema, metricas) => {
    let porLayout = cache.get(tema);
    if (!porLayout) {
      porLayout = new Map();
      cache.set(tema, porLayout);
    }

    const memorizado = porLayout.get(metricas.chave);
    if (memorizado) {
      return memorizado;
    }

    const novo = StyleSheet.create(construir(tema, metricas));
    porLayout.set(metricas.chave, novo);
    return novo;
  };
};

/** Propriedades de texto que acompanham a escala escolhida pelo usuário. */
const CAMPOS_ESCALAVEIS = ['fontSize', 'lineHeight'] as const;

const aplicarEscala = <T extends Estilos>(estilos: T, escala: number): T => {
  if (escala === 1) {
    return estilos;
  }

  const escalados: Estilos = {};

  for (const [nome, estilo] of Object.entries(estilos)) {
    let ajustado: Record<string, unknown> | null = null;

    for (const campo of CAMPOS_ESCALAVEIS) {
      const valor = (estilo as Record<string, unknown>)[campo];
      if (typeof valor === 'number') {
        ajustado = ajustado ?? { ...estilo };
        // Meio ponto é o menor degrau que o Android ainda renderiza diferente;
        // arredondar evita fontes com casas decimais longas.
        ajustado[campo] = Math.round(valor * escala * 2) / 2;
      }
    }

    escalados[nome] = (ajustado ?? estilo) as ViewStyle | TextStyle | ImageStyle;
  }

  return escalados as T;
};

/**
 * Igual a `criarEstilos`, mas multiplica os tamanhos de texto por
 * `metricas.escalaTexto` (a escala que o usuário ajusta pinçando a lista ou
 * pelos chips em Ajustes). Fica fora de `criarEstilos` de propósito: só as
 * telas que participam da pinça crescem — abas, modais e mapa mantêm a
 * tipografia fixa.
 */
export const criarEstilosEscalaveis = <T extends Estilos>(
  construir: (tema: Tema, metricas: Metricas) => T,
): ((tema: Tema, metricas: Metricas) => T) =>
  criarEstilos((tema, metricas) => aplicarEscala(construir(tema, metricas), metricas.escalaTexto));
