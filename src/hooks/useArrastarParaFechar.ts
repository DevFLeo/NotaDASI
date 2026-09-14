import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

const DISTANCIA_PARA_FECHAR = 120;
const VELOCIDADE_PARA_FECHAR = 800;

/**
 * Gesto de "arrastar a alça para baixo para fechar", usado nos modais em
 * formato de bloco de notas (DetalheRegistro, FormularioRegistro).
 *
 * O gesto fica só na alça (puxador) — não no conteúdo rolável — para não
 * disputar com o scroll do modal. O deslocamento é aplicado ao painel
 * inteiro via `estiloArrasto`.
 */
export function useArrastarParaFechar(aoFechar: () => void): {
  gesto: ReturnType<typeof Gesture.Pan>;
  estiloArrasto: ReturnType<typeof useAnimatedStyle>;
  deslocY: SharedValue<number>;
} {
  const deslocY = useSharedValue(0);

  const gesto = Gesture.Pan()
    .onUpdate((evento) => {
      deslocY.value = Math.max(0, evento.translationY);
    })
    .onEnd((evento) => {
      if (deslocY.value > DISTANCIA_PARA_FECHAR || evento.velocityY > VELOCIDADE_PARA_FECHAR) {
        deslocY.value = withTiming(800, { duration: 200 }, () => {
          runOnJS(aoFechar)();
        });
      } else {
        deslocY.value = withSpring(0, { damping: 22 });
      }
    });

  const estiloArrasto = useAnimatedStyle(() => ({
    transform: [{ translateY: deslocY.value }],
  }));

  return { gesto, estiloArrasto, deslocY };
}
