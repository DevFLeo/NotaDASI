/**
 * Tipos para 'react-native-web', que não publica os seus.
 *
 * A API pública do react-native-web espelha a do react-native (é esse o
 * ponto da biblioteca), então reaproveitamos as declarações oficiais do RN
 * em vez de deixar o shim cair em `any` — assim um erro de tipo no alvo PC
 * aparece igual ao que apareceria no Android.
 */
declare module 'react-native-web' {
  export * from 'react-native';
}
