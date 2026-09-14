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
