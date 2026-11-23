import React from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { SessaoProvider } from '../src/auth/useSessao';
import FormularioRegistro from '../src/components/FormularioRegistro';
import ModalParecerUrgencia from '../src/components/ModalParecerUrgencia';
import QuadroKanban from '../src/components/QuadroKanban';
import { registroEmBranco, registrosExemplo, type NovoRegistro, type Registro } from '../src/data/registros';
import { useRegistros } from '../src/data/useRegistros';
import { ThemeProvider } from '../src/tema/ThemeContext';

const envolver = (children: React.ReactNode) => (
  <ThemeProvider>
    <SessaoProvider>{children}</SessaoProvider>
  </ThemeProvider>
);

const extrairTextos = (instancia: renderer.ReactTestInstance): string =>
  instancia
    .findAllByType(Text)
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join(' ');

const acharBotao = (
  raiz: renderer.ReactTestInstance,
  predicado: (texto: string) => boolean,
): renderer.ReactTestInstance | undefined => {
  const candidatos = raiz.findAll(
    (n) => typeof n.props?.onPress === 'function' && predicado(extrairTextos(n).trim()),
  );
  // Retorna o nó mais interno (último da lista em pré-ordem)
  return candidatos[candidatos.length - 1];
};

describe('UI Kanban, Parecer de Urgência e Número do SEI opcional', () => {
  test('QuadroKanban exibe as 5 colunas, foca coluna sem ScrollView vertical aninhado e submete parecer', async () => {
    const aoSelecionar = jest.fn();
    const aoMoverColuna = jest.fn();
    const aoRegistrarParecerUrgencia = jest.fn();

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        envolver(
          <QuadroKanban
            registros={registrosExemplo}
            aoSelecionar={aoSelecionar}
            aoMoverColuna={aoMoverColuna}
            aoRegistrarParecerUrgencia={aoRegistrarParecerUrgencia}
          />,
        ),
      );
    });

    const textoGeral = extrairTextos(tree.root);
    expect(textoGeral).toContain('Não iniciado');
    expect(textoGeral).toContain('Em processo');
    expect(textoGeral).toContain('Urgência');
    expect(textoGeral).toContain('Revisão');
    expect(textoGeral).toContain('Concluído');

    // Foca apenas na coluna Urgência — não deve renderizar ScrollView vertical (horizontal={false})
    const botaoUrgencia = acharBotao(tree.root, (t) => t.startsWith('Urgência ('));
    expect(botaoUrgencia).toBeDefined();

    await act(async () => {
      botaoUrgencia!.props.onPress();
    });

    const scrollViewsVerticais = tree.root
      .findAllByType(ScrollView)
      .filter((s) => !s.props.horizontal);
    expect(scrollViewsVerticais).toHaveLength(0);

    // Abre ModalParecerUrgencia clicando em "Emitir Parecer"
    const botaoEmitir = acharBotao(tree.root, (t) => t === 'Emitir Parecer');
    expect(botaoEmitir).toBeDefined();

    await act(async () => {
      botaoEmitir!.props.onPress({ stopPropagation: () => {} });
    });

    const modal = tree.root.findByType(ModalParecerUrgencia);
    expect(modal.props.visivel).toBe(true);

    // Preenche responsável pela continuidade, SEI opcional e parecer
    const inputs = modal.findAllByType(TextInput);
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    await act(async () => {
      inputs[0].props.onChangeText('Coordenação DGEO');
      inputs[1].props.onChangeText('00600-00054321/2026-99');
      inputs[2].props.onChangeText('Encaminhado para revisão técnica e continuidade.');
    });

    const botaoRegistrar = acharBotao(modal, (t) => t === 'Registrar Parecer');
    expect(botaoRegistrar).toBeDefined();

    await act(async () => {
      botaoRegistrar!.props.onPress();
    });

    expect(aoRegistrarParecerUrgencia).toHaveBeenCalledTimes(1);
    expect(aoRegistrarParecerUrgencia).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        decisao: 'revisao',
        responsavelContinuidade: 'Coordenação DGEO',
        numeroSei: '00600-00054321/2026-99',
        parecer: 'Encaminhado para revisão técnica e continuidade.',
      }),
    );
  });

  test('ModalParecerUrgencia preserva texto digitado quando registro recebe nova referência com mesmo id e permite limpar continuidade', async () => {
    const registroBase: Registro = {
      ...registrosExemplo[3],
      kanban: {
        colunaManual: 'revisao',
        responsavelContinuidade: 'Gerência Antiga',
      },
    };
    const aoConfirmar = jest.fn();
    const aoFechar = jest.fn();

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        envolver(
          <ModalParecerUrgencia
            registro={registroBase}
            visivel
            aoFechar={aoFechar}
            aoConfirmar={aoConfirmar}
          />,
        ),
      );
    });

    const inputs = tree.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText(''); // Limpa responsável pela continuidade
      inputs[2].props.onChangeText('Concluído após validação.');
    });

    // Atualiza prop com nova referência para o mesmo ID (como faz selecionadoSincronizado)
    await act(async () => {
      tree.update(
        envolver(
          <ModalParecerUrgencia
            registro={{ ...registroBase }}
            visivel
            aoFechar={aoFechar}
            aoConfirmar={aoConfirmar}
          />,
        ),
      );
    });

    const inputsAposUpdate = tree.root.findAllByType(TextInput);
    expect(inputsAposUpdate[2].props.value).toBe('Concluído após validação.');

    const botaoRegistrar = acharBotao(tree.root, (t) => t === 'Registrar Parecer');
    expect(botaoRegistrar).toBeDefined();

    await act(async () => {
      botaoRegistrar!.props.onPress();
    });

    expect(aoConfirmar).toHaveBeenCalledWith(
      registroBase.id,
      expect.objectContaining({
        responsavelContinuidade: '',
        parecer: 'Concluído após validação.',
      }),
    );
  });

  test('FormularioRegistro salva número SEI opcional no card e no comentário/despacho no cadastro', async () => {
    const aoSalvar = jest.fn();
    const aoCancelar = jest.fn();

    const inicial: NovoRegistro = registroEmBranco({
      setor: 'Divisão de Controle',
      competencia: 'Competência com despacho inicial',
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        envolver(
          <FormularioRegistro
            visivel
            tituloModal="Nova competência"
            valorInicial={inicial}
            aoSalvar={aoSalvar}
            aoCancelar={aoCancelar}
          />,
        ),
      );
    });

    const inputs = tree.root.findAllByType(TextInput);
    const inputSeiCard = inputs.find((i) => i.props.placeholder === 'Ex.: 00600-00012345/2026-01');
    const inputSeiComentario = inputs.find((i) =>
      String(i.props.placeholder ?? '').includes('Número do SEI do comentário'),
    );
    const inputComentario = inputs.find((i) =>
      String(i.props.placeholder ?? '').includes('Adicionar comentário, despacho'),
    );

    expect(inputSeiCard).toBeDefined();
    expect(inputSeiComentario).toBeDefined();
    expect(inputComentario).toBeDefined();

    await act(async () => {
      inputSeiCard!.props.onChangeText('00600-00011111/2026-01');
      inputSeiComentario!.props.onChangeText('00600-00022222/2026-02');
      inputComentario!.props.onChangeText('Despacho inicial registrado no cadastro.');
    });

    const botaoSalvar = acharBotao(tree.root, (t) => t.startsWith('Salvar'));
    expect(botaoSalvar).toBeDefined();

    await act(async () => {
      botaoSalvar!.props.onPress();
    });

    expect(aoSalvar).toHaveBeenCalledTimes(1);
    const salvo: NovoRegistro = aoSalvar.mock.calls[0][0];
    expect(salvo.numeroSei).toBe('00600-00011111/2026-01');
    expect(salvo.comentarios).toHaveLength(1);
    expect(salvo.comentarios![0].texto).toBe('Despacho inicial registrado no cadastro.');
    expect(salvo.comentarios![0].numeroSei).toBe('00600-00022222/2026-02');
  });

  test('useRegistros permite limpar responsavelContinuidade ao registrar parecer e restaurar modo automático', async () => {
    let estado!: ReturnType<typeof useRegistros>;
    const Capturador: React.FC = () => {
      estado = useRegistros();
      return null;
    };

    await act(async () => {
      renderer.create(<Capturador />);
    });

    const alvo = estado.registros[0];
    expect(alvo).toBeDefined();

    await act(async () => {
      estado.registrarParecerUrgencia(alvo.id, {
        usuario: 'dasi',
        nome: 'Equipe DASI',
        papel: 'dasi',
        decisao: 'revisao',
        parecer: 'Revisar pendência com a gerência.',
        responsavelContinuidade: 'Gerência DICI',
        numeroSei: '00600-00077777/2026-77',
      });
    });

    let atualizado = estado.registros.find((r) => r.id === alvo.id)!;
    expect(atualizado.kanban?.colunaManual).toBe('revisao');
    expect(atualizado.kanban?.responsavelContinuidade).toBe('Gerência DICI');
    expect(atualizado.numeroSei).toBe('00600-00077777/2026-77');
    expect(atualizado.comentarios?.at(-1)?.numeroSei).toBe('00600-00077777/2026-77');

    // Novo parecer para Concluído limpando o responsável pela continuidade
    await act(async () => {
      estado.registrarParecerUrgencia(alvo.id, {
        usuario: 'dasi',
        nome: 'Equipe DASI',
        papel: 'dasi',
        decisao: 'concluido',
        parecer: 'Demanda encerrada.',
        responsavelContinuidade: '',
      });
    });

    atualizado = estado.registros.find((r) => r.id === alvo.id)!;
    expect(atualizado.kanban?.colunaManual).toBe('concluido');
    expect(atualizado.kanban?.responsavelContinuidade).toBeUndefined();

    // Restaura cálculo automático
    await act(async () => {
      estado.moverColunaKanban(alvo.id, undefined);
    });

    atualizado = estado.registros.find((r) => r.id === alvo.id)!;
    expect(atualizado.kanban?.colunaManual).toBeUndefined();
  });
});
