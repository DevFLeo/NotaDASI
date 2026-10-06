import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';

/**
 * O mock padrão do react-native-safe-area-context (jest/setup.js) devolve um
 * SafeAreaProvider que não renderiza os filhos — a árvore inteira sai vazia e
 * nenhum rótulo é encontrável. Aqui o provedor é transparente, que é o que
 * interessa para checar o CONTEÚDO das telas.
 */
jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      ReactMock.createElement(ReactMock.Fragment, null, children),
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => insets,
    initialWindowMetrics: { frame: { x: 0, y: 0, width: 390, height: 844 }, insets },
  };
});

import App, { Provedores } from '../App';
import CascaPC from '../pc/CascaPC';

/** Junta todo o texto renderizado na árvore, para procurar rótulos. */
const textoDaArvore = (no: ReactTestRendererJSON | string | null): string => {
  if (no === null) {
    return '';
  }
  if (typeof no === 'string') {
    return `${no} `;
  }
  return (no.children ?? [])
    .map((filho) => textoDaArvore(filho as ReactTestRendererJSON | string))
    .join('');
};

const montar = async (elemento: React.ReactElement): Promise<renderer.ReactTestRenderer> => {
  let arvore: renderer.ReactTestRenderer | null = null;

  await act(async () => {
    arvore = renderer.create(elemento);
  });

  return arvore as unknown as renderer.ReactTestRenderer;
};

const texto = (arvore: renderer.ReactTestRenderer): string =>
  textoDaArvore(arvore.toJSON() as ReactTestRendererJSON | null);

/** Acha o item da barra lateral pelo rótulo de acessibilidade. */
const itemDaBarra = (arvore: renderer.ReactTestRenderer, rotulo: string) =>
  arvore.root.findAll(
    (no) => no.props?.accessibilityRole === 'tab' && no.props?.accessibilityLabel === rotulo,
  )[0];

describe('porta de entrada', () => {
  it('sem sessão salva, o app abre no login e não na lista', async () => {
    // O AsyncStorage está mockado devolvendo null (ver jest/setup.js), que é
    // exatamente o estado de uma instalação nova.
    const arvore = await montar(<App />);
    const conteudo = texto(arvore);

    expect(conteudo).toContain('Entrar');
    expect(conteudo).toContain('DASI');
    expect(conteudo).toContain('GERENTE - DGEO');
    expect(conteudo).toContain('SECRETARIO');
  });
});

describe('casca do PC', () => {
  it('abre com o mapa em foco e o seletor de campo no topo', async () => {
    // Renderizada sem a porta de entrada de propósito: aqui o que se verifica
    // é a geometria da tela, não o login.
    const arvore = await montar(
      <Provedores>
        <CascaPC />
      </Provedores>,
    );
    const conteudo = texto(arvore);

    // Seletor de campo, no canto superior esquerdo.
    expect(conteudo).toContain('Campo');
    expect(conteudo).toContain('Acompanhamento do SIG');

    // O mapa mental é o foco: aparece sem ninguém pedir, com os dados reais —
    // a raiz é a prefeitura e, em volta, as secretarias da planilha.
    expect(conteudo).toContain('Porto Velho');
    expect(conteudo).toContain('SEMUR');
    expect(conteudo).toContain('Ajustar à tela');

    // Os itens da barra existem mesmo quando ela está reduzida a ícones
    // (a janela do Jest é estreita, então ela já nasce reduzida).
    expect(itemDaBarra(arvore, 'Lista')).toBeDefined();
    expect(itemDaBarra(arvore, 'Planilha')).toBeDefined();
    expect(itemDaBarra(arvore, 'Ajustes')).toBeDefined();
  });

  it('o painel Planilha mostra todas as abas da pasta de trabalho', async () => {
    const arvore = await montar(
      <Provedores>
        <CascaPC />
      </Provedores>,
    );

    await act(async () => {
      itemDaBarra(arvore, 'Planilha').props.onPress();
    });
    const conteudo = texto(arvore);

    for (const aba of ['SEMUR', 'SEMFAZ', 'SEMUSB', 'SEMA', 'SEMTRAN', 'Estrutura interna', 'Página6']) {
      expect(conteudo).toContain(aba);
    }
    expect(conteudo).toContain('Avanço das Atividades');
  });

  it('acionar um item da barra abre o painel, e acionar de novo fecha', async () => {
    const arvore = await montar(
      <Provedores>
        <CascaPC />
      </Provedores>,
    );

    expect(itemDaBarra(arvore, 'Lista').props.accessibilityState.selected).toBe(false);

    await act(async () => {
      itemDaBarra(arvore, 'Lista').props.onPress();
    });
    expect(itemDaBarra(arvore, 'Lista').props.accessibilityState.selected).toBe(true);

    // Clicar no item já aberto devolve o mapa inteiro — é o caminho de volta
    // para o foco.
    await act(async () => {
      itemDaBarra(arvore, 'Lista').props.onPress();
    });
    expect(itemDaBarra(arvore, 'Lista').props.accessibilityState.selected).toBe(false);
  });
});
