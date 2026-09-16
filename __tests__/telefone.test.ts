import { digitosDe, paraDiscagem, pareceTelefone } from '../src/data/telefone';

test('sequências do tamanho de um telefone são reconhecidas', () => {
  expect(pareceTelefone('69999887766')).toBe(true);
  expect(pareceTelefone('(69) 99988-7766')).toBe(true);
  expect(pareceTelefone('69 3901-3000')).toBe(true);
  expect(pareceTelefone('+55 69 99988-7766')).toBe(true);
});

test('número que não é telefone continua texto comum', () => {
  // Quantidade, sala, ano: curtos demais para virar botão de ligação.
  expect(pareceTelefone('25')).toBe(false);
  expect(pareceTelefone('2026')).toBe(false);
  expect(pareceTelefone('1234567')).toBe(false);
  // Longo demais (código de barras, protocolo).
  expect(pareceTelefone('1234567890123456')).toBe(false);
  // Tem letra, símbolo ou vírgula decimal: é texto.
  expect(pareceTelefone('R$ 12.345,67')).toBe(false);
  expect(pareceTelefone('processo 12345678/2026-A')).toBe(false);
  expect(pareceTelefone('')).toBe(false);
  // O '+' só vale como prefixo de país.
  expect(pareceTelefone('12345678+9')).toBe(false);
});

test('a discagem mantém só os dígitos, e o + do país quando existe', () => {
  expect(digitosDe('(69) 99988-7766')).toBe('69999887766');
  expect(paraDiscagem('(69) 99988-7766')).toBe('69999887766');
  expect(paraDiscagem('+55 69 99988-7766')).toBe('+5569999887766');
});
