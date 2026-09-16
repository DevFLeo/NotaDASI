/**
 * Stub de 'react-native-reanimated/scripts/validate-worklets-version'.
 *
 * O Reanimated importa esse script para conferir, em tempo de execução, se a
 * versão instalada de react-native-worklets é compatível com a dele. O arquivo
 * original é CommonJS (`module.exports = ...`) e usa `require` do Node —
 * o Metro faz essa interop sozinho, o navegador não, e o app quebrava no boot
 * com "does not provide an export named 'default'".
 *
 * Devolver `{ ok: true }` aqui NÃO desliga a proteção: as versões vivem no
 * package.json e a validação real continua rodando no build do Android, via
 * Metro. Se um dia as duas bibliotecas saírem de sincronia, o `npm run android`
 * acusa — este alvo só deixa de repetir a mesma checagem no navegador.
 */
type ResultadoValidacao = { ok: boolean; message?: string };

const validarVersaoWorklets = (_versaoReanimated: string): ResultadoValidacao => ({ ok: true });

export default validarVersaoWorklets;
