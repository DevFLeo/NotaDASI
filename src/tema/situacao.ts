import type { SituacaoAdesao } from '../data/registros';
import type { Tema } from './cores';

/**
 * Cores do selo de situação, tiradas do TEMA.
 *
 * `corPorSituacao` (em data/registros.ts) são tons pastel fixos, pensados para
 * os nós do mapa mental. Usados como cor de texto num cartão claro eles somem:
 * amarelo-claro sobre branco fica abaixo de 1.5:1 de contraste. Aqui cada
 * situação aponta para um token de status, que já tem uma versão para o tema
 * claro e outra para o escuro (o contraste é conferido em __tests__/tema.test.ts).
 */
export const coresDaSituacao = (
  tema: Tema,
  situacao: SituacaoAdesao,
): { cor: string; fundo: string } => {
  switch (situacao) {
    case 'aderido':
      return { cor: tema.sucesso, fundo: tema.sucessoFundo };
    case 'parcial':
      return { cor: tema.alerta, fundo: tema.alertaFundo };
    case 'pendente':
      return { cor: tema.erro, fundo: tema.erroFundo };
    case 'problema':
      return { cor: tema.problema, fundo: tema.problemaFundo };
  }
};
