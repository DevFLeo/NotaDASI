/**
 * Escala de raios de canto.
 *
 * Antes cada tela escolhia o seu (10, 12, 14, 15, 16, 18, 20, 22, 24, 26...) e
 * dois botões lado a lado saíam com cantos diferentes. Quatro degraus bastam:
 *
 * - `p`  — selos internos, avisos, itens pequenos
 * - `m`  — botões, campos de texto, linhas tocáveis
 * - `g`  — cartões e painéis
 * - `xg` — folhas (modais) e o cartão de login
 * - `pilula` — chips e selos totalmente arredondados
 *
 * Círculos (avatar, FAB) continuam com metade do próprio tamanho, fora da escala.
 */
export const raios = {
  p: 8,
  m: 12,
  g: 16,
  xg: 24,
  pilula: 999,
} as const;
