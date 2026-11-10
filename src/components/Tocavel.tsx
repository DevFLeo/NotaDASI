import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /**
   * Realce discreto, para áreas grandes (um cartão inteiro): escurecer 30% de
   * um cartão a cada toque chama mais atenção do que a ação merece.
   */
  suave?: boolean;
};

/**
 * `Pressable` com retorno de interação igual no app inteiro.
 *
 * Antes quase nenhum botão respondia ao toque: no Android só o cartão da lista
 * tinha ripple, e no PC nada mudava ao passar o mouse. Aqui todo alvo ganha:
 *
 * - **pressionado** — fica mais apagado enquanto o dedo/mouse está embaixo;
 * - **mouse em cima** (só existe na web) — um apagado bem leve.
 *
 * O anel de foco do teclado no PC não mora aqui: `:focus-visible` não existe
 * em StyleSheet, então ele é uma regra de CSS em `pc/index.html`.
 *
 * Use no lugar de `Pressable` em qualquer botão, chip, aba ou linha tocável.
 */
const Tocavel: React.FC<Props> = ({ style, suave, disabled, ...resto }) => (
  <Pressable
    disabled={disabled}
    {...resto}
    style={(estado) => {
      // `hovered` só é preenchido pelo react-native-web; os tipos do RN não o
      // declaram.
      const { pressed, hovered } = estado as { pressed: boolean; hovered?: boolean };
      return [
        style,
        hovered && !disabled && (suave ? estilos.sobreSuave : estilos.sobre),
        pressed && (suave ? estilos.pressionadoSuave : estilos.pressionado),
      ];
    }}
  />
);

const estilos = StyleSheet.create({
  sobre: { opacity: 0.86 },
  sobreSuave: { opacity: 0.94 },
  pressionado: { opacity: 0.68 },
  pressionadoSuave: { opacity: 0.86 },
});

export default Tocavel;
