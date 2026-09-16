import React from 'react';
import { AppConteudo } from '../App';
import CascaPC from './CascaPC';
import { useMetricas } from '../src/tema/ThemeContext';

/**
 * Escolhe a casca conforme a largura da janela do navegador.
 *
 * O alvo PC não é "outro app": é o mesmo app com mais espaço. Quando o espaço
 * não existe — janela encolhida, monitor pequeno, o navegador do celular — o
 * certo é usar a casca que já foi desenhada para pouco espaço (a do celular,
 * `AppConteudo`), e não espremer barra lateral + painel + mapa em 700px.
 *
 * É por isso que o corte é largo: abaixo dele, o painel de 35% ficaria com uns
 * 230px, estreito demais para um cartão da lista, e o mapa perderia justamente
 * a visão de conjunto que faz dele o foco desta tela.
 *
 * A troca é automática e reversível: arrastar a borda da janela alterna entre
 * as duas cascas na hora, porque as duas leem o mesmo estado.
 */
const LIMITE_CASCA_PC = 900;

const RaizPC: React.FC = () => {
  const metricas = useMetricas();

  return metricas.largura >= LIMITE_CASCA_PC ? <CascaPC /> : <AppConteudo />;
};

export default RaizPC;
