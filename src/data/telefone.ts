/**
 * Reconhece quando um valor digitado é uma sequência de números que vale a
 * pena tratar como telefone (copiar com um toque, ligar segurando).
 *
 * O critério é deliberadamente conservador: um campo "Número" com 25 (uma
 * quantidade, uma sala, uma idade) NÃO pode virar um botão de ligação. Só
 * entram sequências do tamanho de um telefone e escritas como telefone —
 * dígitos com os separadores de sempre.
 */

/** Separadores aceitos dentro de um telefone: espaço, ( ) - . / e o + inicial. */
const SEPARADORES = /[\s().\-/]/g;

/** Curto demais é ramal solto ou quantidade; longo demais não é telefone. */
const MINIMO_DIGITOS = 8;
const MAXIMO_DIGITOS = 15;

/** Só os dígitos, do jeito que o discador espera. */
export const digitosDe = (texto: string): string => texto.replace(/\D/g, '');

export const pareceTelefone = (texto: string): boolean => {
  const limpo = texto.trim();
  if (!limpo) {
    return false;
  }

  // Um '+' só vale como prefixo de país, no começo.
  const semMais = limpo.startsWith('+') ? limpo.slice(1) : limpo;
  if (semMais.includes('+')) {
    return false;
  }

  // Qualquer coisa que não seja dígito ou separador (uma letra, um R$, uma
  // vírgula decimal) tira o valor da regra: é texto, não telefone.
  if (/[^\d]/.test(semMais.replace(SEPARADORES, ''))) {
    return false;
  }

  const digitos = digitosDe(limpo);
  return digitos.length >= MINIMO_DIGITOS && digitos.length <= MAXIMO_DIGITOS;
};

/**
 * Número no formato que o `tel:` entende. Mantém o '+' quando o usuário
 * escreveu o código do país — sem ele, um número internacional disca errado.
 */
export const paraDiscagem = (texto: string): string =>
  `${texto.trim().startsWith('+') ? '+' : ''}${digitosDe(texto)}`;
