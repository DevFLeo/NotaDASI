import { useCallback, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const DISTANCIA_PARA_FECHAR = 100;
const VELOCIDADE_PARA_FECHAR = 600;
const DISTANCIA_PARA_EXPANDIR = 40;
const VELOCIDADE_PARA_EXPANDIR = -300;

/**
 * Gesto na alça do modal (puxador):
 * - Arrastar para cima: expande para TELA CHEIA (100% da altura).
 * - Arrastar para baixo em tela cheia: volta para a altura padrão.
 * - Arrastar para baixo na altura padrão: fecha o modal.
 *
 * Também exporta `telaCheia` e `alternarTelaCheia()` para controle por botão (⤢ / 🗖).
 */
export function useArrastarParaFechar(aoFechar: () => void): {
  gesto: ReturnType<typeof Gesture.Pan>;
  estiloArrasto: ReturnType<typeof useAnimatedStyle>;
  deslocY: SharedValue<number>;
  telaCheia: boolean;
  alternarTelaCheia: () => void;
  definirTelaCheia: (ativar: boolean) => void;
} {
  const deslocY = useSharedValue(0);
  const [telaCheia, setTelaCheia] = useState(false);

  const definirTelaCheiaJs = useCallback((ativar: boolean) => {
    setTelaCheia(ativar);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    setTelaCheia((atual) => !atual);
  }, []);

  const gesto = Gesture.Pan()
    .onUpdate((evento) => {
      // Permite puxar para cima e para baixo suavemente
      deslocY.value = evento.translationY;
    })
    .onEnd((evento) => {
      const transY = evento.translationY;
      const velY = evento.velocityY;

      if (!telaCheia) {
        // Estado normal: puxar para cima expande em tela cheia
        if (transY < -DISTANCIA_PARA_EXPANDIR || velY < VELOCIDADE_PARA_EXPANDIR) {
          deslocY.value = withSpring(0, { damping: 22 });
          runOnJS(definirTelaCheiaJs)(true);
          return;
        }

        // Puxar para baixo fecha
        if (transY > DISTANCIA_PARA_FECHAR || velY > VELOCIDADE_PARA_FECHAR) {
          deslocY.value = withTiming(800, { duration: 200 }, () => {
            runOnJS(aoFechar)();
          });
          return;
        }

        // Caso contrário, retorna à posição de repouso
        deslocY.value = withSpring(0, { damping: 22 });
      } else {
        // Estado tela cheia: puxar para baixo retorna ao tamanho normal
        if (transY > DISTANCIA_PARA_EXPANDIR || velY > 500) {
          deslocY.value = withSpring(0, { damping: 22 });
          runOnJS(definirTelaCheiaJs)(false);
          return;
        }

        deslocY.value = withSpring(0, { damping: 22 });
      }
    });

  const estiloArrasto = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(-220, deslocY.value) }],
  }));

  return {
    gesto,
    estiloArrasto,
    deslocY,
    telaCheia,
    alternarTelaCheia,
    definirTelaCheia: definirTelaCheiaJs,
  };
}
