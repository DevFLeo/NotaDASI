/* eslint-env jest */
// Mocks das bibliotecas nativas: no Jest nao existe o modulo nativo por tras
// delas, entao trocamos por implementacoes leves so para a arvore renderizar.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Fake = (props) => React.createElement(View, props, props.children);

  return {
    __esModule: true,
    default: Fake,
    Svg: Fake,
    Line: Fake,
    Circle: Fake,
    Path: Fake,
    G: Fake,
    Rect: Fake,
    Text: Fake,
  };
});
