import { useCallback, useRef } from 'react';

/**
 * "Segurar para abrir um painel", do jeito que não dispara nada sem querer.
 *
 * O problema: um `onLongPress` que abre um Modal faz o painel nascer DEBAixo do
 * dedo, que ainda está na tela — e, quando o gesto começa na barra de abas, o
 * rodapé do painel aparece exatamente ali. O toque que apenas solta o dedo cai
 * num botão que não existia quando o gesto começou. Barrar toques por alguns
 * milissegundos não resolve: se o usuário segurar um pouco mais, a janela morta
 * já expirou quando ele solta.
 *
 * A solução é não depender de tempo nenhum: o `onLongPress` só ARMA, e quem
 * abre o painel é o `onPressOut` — com o dedo já fora da tela, não há o que
 * acertar por engano.
 *
 * Use espalhando o retorno num `Pressable`:
 *
 *     <Pressable onPress={...} {...useSegurarParaAbrir(abrirMenu)} />
 */
export function useSegurarParaAbrir(aoAbrir?: () => void): {
  onLongPress?: () => void;
  onPressOut?: () => void;
  delayLongPress: number;
} {
  const armado = useRef(false);

  const onLongPress = useCallback(() => {
    armado.current = true;
  }, []);

  const onPressOut = useCallback(() => {
    if (!armado.current) {
      return;
    }
    armado.current = false;
    aoAbrir?.();
  }, [aoAbrir]);

  // Sem `aoAbrir` o componente não deve virar "segurável": devolver os
  // manipuladores mesmo assim faria o Pressable tratar o toque longo como
  // gesto próprio e engolir o que viesse depois.
  return aoAbrir
    ? { onLongPress, onPressOut, delayLongPress: 350 }
    : { delayLongPress: 350 };
}
