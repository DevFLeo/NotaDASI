const React = require('react');
const { View } = require('react-native');

/** Construtor de animação falso: aceita o encadeamento .duration().delay()... */
class ConstrutorDeAnimacaoFake {
  duration() {
    return this;
  }
  delay() {
    return this;
  }
  springify() {
    return this;
  }
  damping() {
    return this;
  }
  build() {
    return () => ({ initialValues: {}, animations: {} });
  }
}

const criarAnimacaoFake = () => new ConstrutorDeAnimacaoFake();

const componenteFake = (Base) =>
  React.forwardRef((props, ref) => React.createElement(Base, { ...props, ref }));

const AnimatedView = componenteFake(View);

/** Shared value falso: guarda o valor em memória, sem worklets. */
const useSharedValue = (inicial) => {
  const referencia = React.useRef({ value: inicial });
  return referencia.current;
};

module.exports = {
  __esModule: true,

  default: {
    View: AnimatedView,
    Text: componenteFake(require('react-native').Text),
    ScrollView: componenteFake(require('react-native').ScrollView),
    createAnimatedComponent: (Base) => componenteFake(Base),
  },

  // Usado pelo react-native-gesture-handler internamente.
  createAnimatedComponent: (Base) => componenteFake(Base),

  // Animações de entrada / layout usadas nos componentes.
  FadeInUp: criarAnimacaoFake(),
  FadeIn: criarAnimacaoFake(),
  LinearTransition: criarAnimacaoFake(),
  Layout: criarAnimacaoFake(),

  // API de worklets usada pelo mapa mental.
  useSharedValue,
  useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
  useAnimatedRef: () => ({ current: null }),
  withSpring: (valor) => valor,
  withTiming: (valor) => valor,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};
