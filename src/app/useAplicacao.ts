import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { Anotacao, Campo } from '../data/campos';
import { registroEmBranco, type NovoRegistro, type Registro } from '../data/registros';
import { useCampos } from '../data/useCampos';
import { useRegistros } from '../data/useRegistros';

/**
 * Todo o estado do NotaDASI num lugar só: dados, seleção e o que está aberto.
 *
 * Existe porque agora há DUAS cascas para a mesma aplicação — a do celular
 * (App.tsx, abas embaixo) e a do PC (pc/CascaPC.tsx, barra lateral com o mapa
 * em foco). Elas desenham diferente, mas mandam exatamente nos mesmos dados e
 * abrem exatamente os mesmos formulários. Sem esta função, a segunda casca
 * teria que reescrever ~120 linhas de `useState`/`useCallback` idênticas, e
 * qualquer regra nova (uma confirmação de exclusão, por exemplo) precisaria
 * ser lembrada nos dois lugares.
 *
 * Chame UMA VEZ, na raiz da casca, e passe o resultado para `<Modais />`.
 */

export type EstadoFormulario =
  | { modo: 'criar'; sugestao?: Partial<Registro> }
  | { modo: 'editar'; registro: Registro }
  | null;

/** Item de campo livre sendo criado ou editado (ver MenuCampos/FormularioAnotacao). */
export type EstadoAnotacao = { modo: 'criar' } | { modo: 'editar'; anotacao: Anotacao } | null;

export type Aplicacao = ReturnType<typeof useAplicacao>;

export function useAplicacao() {
  const [selecionado, setSelecionadoState] = useState<Registro | null>(null);
  const [formulario, setFormulario] = useState<EstadoFormulario>(null);
  const [menuCampos, setMenuCampos] = useState(false);
  const [anotacaoEmEdicao, setAnotacaoEmEdicao] = useState<EstadoAnotacao>(null);

  const selecionarRegistro = useCallback((registro: Registro | null) => {
    if (!registro) {
      setSelecionadoState(null);
    } else {
      // Sempre gera uma nova referência com timestamp único para forçar o React
      // a remontar/reabrir os modais sem risco de bailout por igualdade referencial.
      setSelecionadoState({ ...registro, _stamp: Date.now() });
    }
  }, []);

  const {
    registros,
    origem,
    aceiteExcel,
    nomePlanilhaAtiva,
    criarRegistro,
    atualizarRegistro,
    excluirRegistro,
    alternarFavorito,
    adicionarComentario,
    moverColunaKanban,
    registrarParecerUrgencia,
    salvarNotaPessoal,
    limparDadosLocais,
    salvarAceiteExcel,
    reverterAceiteExcel,
    carregarBasePlanilha,
    restaurarBasePadrao,
  } = useRegistros();

  const {
    campos,
    campoAtivo,
    anotacoes,
    definirCampoAtivo,
    criarCampo,
    atualizarCampo,
    excluirCampo,
    criarAnotacao,
    atualizarAnotacao,
    excluirAnotacao,
    totalDeItens,
  } = useCampos();

  const eCampoLivre = campoAtivo.tipo !== 'sig';

  const contarItens = useCallback(
    (campo: Campo) => totalDeItens(campo, registros.length),
    [totalDeItens, registros.length],
  );

  const abrirMenuCampos = useCallback(() => setMenuCampos(true), []);
  const fecharMenuCampos = useCallback(() => setMenuCampos(false), []);

  const salvarAnotacao = useCallback(
    (valores: Anotacao['valores']) => {
      if (anotacaoEmEdicao?.modo === 'editar') {
        atualizarAnotacao(campoAtivo.id, anotacaoEmEdicao.anotacao.id, valores);
      } else {
        criarAnotacao(campoAtivo.id, valores);
      }
      setAnotacaoEmEdicao(null);
    },
    [anotacaoEmEdicao, atualizarAnotacao, criarAnotacao, campoAtivo.id],
  );

  const pedirExclusaoAnotacao = useCallback(
    (anotacao: Anotacao) => {
      Alert.alert('Excluir item', 'Essa ação não pode ser desfeita. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            excluirAnotacao(campoAtivo.id, anotacao.id);
            setAnotacaoEmEdicao(null);
          },
        },
      ]);
    },
    [excluirAnotacao, campoAtivo.id],
  );

  const abrirCriacao = useCallback((sugestao?: Partial<Registro>) => {
    setFormulario({ modo: 'criar', sugestao });
  }, []);

  const abrirEdicao = useCallback((registro: Registro) => {
    selecionarRegistro(null);
    setFormulario({ modo: 'editar', registro });
  }, [selecionarRegistro]);

  const fecharFormulario = useCallback(() => setFormulario(null), []);

  const alternarFavoritoDoRegistro = useCallback(
    (registro: Registro) => alternarFavorito(registro.id),
    [alternarFavorito],
  );

  const salvarFormulario = useCallback(
    (dados: NovoRegistro) => {
      if (formulario?.modo === 'editar') {
        atualizarRegistro(formulario.registro.id, dados);
      } else {
        criarRegistro(dados);
      }
      setFormulario(null);
    },
    [formulario, atualizarRegistro, criarRegistro],
  );

  const pedirExclusao = useCallback(
    (registro: Registro) => {
      Alert.alert('Excluir competência', 'Essa ação não pode ser desfeita. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            excluirRegistro(registro.id);
            selecionarRegistro(null);
            setFormulario(null);
          },
        },
      ]);
    },
    [excluirRegistro, selecionarRegistro],
  );

  /**
   * Mantém o registro selecionado sincronizado com a lista viva (`registros`),
   * preservando `_stamp` para que novos comentários, números SEI e pareceres
   * apareçam imediatamente no modal aberto sem precisar fechá-lo.
   */
  const selecionadoSincronizado = useMemo(() => {
    if (!selecionado) return null;
    const atualizado = registros.find((r) => r.id === selecionado.id);
    return atualizado ? { ...atualizado, _stamp: selecionado._stamp } : selecionado;
  }, [selecionado, registros]);

  /**
   * Posição da competência selecionada dentro do seu próprio setor,
   * permitindo navegação instantânea no PC através de botões [← Anterior] [Próximo →] e setas do teclado.
   */
  const posicaoSelecionado = useMemo(() => {
    if (!selecionadoSincronizado) {
      return { indice: 0, total: 0, lista: [] as Registro[] };
    }
    const setorAlvo = (selecionadoSincronizado.setorSigla || selecionadoSincronizado.setor || '').trim().toUpperCase();
    const lista = registros.filter(
      (r) => (r.setorSigla || r.setor || '').trim().toUpperCase() === setorAlvo,
    );
    const indice = lista.findIndex((r) => r.id === selecionadoSincronizado.id);
    return {
      indice: indice >= 0 ? indice : 0,
      total: lista.length,
      lista,
    };
  }, [selecionadoSincronizado, registros]);

  const navegarRegistroAnterior = useCallback(() => {
    if (!selecionado || posicaoSelecionado.total <= 1) return;
    const { lista, indice } = posicaoSelecionado;
    const anteriorIdx = (indice - 1 + lista.length) % lista.length;
    const anterior = lista[anteriorIdx];
    if (anterior) {
      selecionarRegistro(anterior);
    }
  }, [selecionado, posicaoSelecionado, selecionarRegistro]);

  const navegarProximoRegistro = useCallback(() => {
    if (!selecionado || posicaoSelecionado.total <= 1) return;
    const { lista, indice } = posicaoSelecionado;
    const proximoIdx = (indice + 1) % lista.length;
    const proximo = lista[proximoIdx];
    if (proximo) {
      selecionarRegistro(proximo);
    }
  }, [selecionado, posicaoSelecionado, selecionarRegistro]);

  const valorInicialFormulario = useMemo(
    () =>
      formulario?.modo === 'editar' ? formulario.registro : registroEmBranco(formulario?.sugestao),
    [formulario],
  );

  const abrirAnotacao = useCallback(
    (anotacao: Anotacao) => setAnotacaoEmEdicao({ modo: 'editar', anotacao }),
    [],
  );

  const criarNovaAnotacao = useCallback(() => setAnotacaoEmEdicao({ modo: 'criar' }), []);

  const fecharAnotacao = useCallback(() => setAnotacaoEmEdicao(null), []);

  return {
    // Dados
    registros,
    origem,
    aceiteExcel,
    nomePlanilhaAtiva,
    salvarAceiteExcel,
    reverterAceiteExcel,
    carregarBasePlanilha,
    restaurarBasePadrao,
    campos,
    campoAtivo,
    anotacoes,
    eCampoLivre,
    limparDadosLocais,

    // Campos (cofres)
    definirCampoAtivo,
    criarCampo,
    atualizarCampo,
    excluirCampo,
    contarItens,
    menuCampos,
    abrirMenuCampos,
    fecharMenuCampos,

    // Registro selecionado / formulário de competência
    selecionado: selecionadoSincronizado,
    setSelecionado: selecionarRegistro,
    posicaoSelecionado,
    navegarRegistroAnterior,
    navegarProximoRegistro,
    formulario,
    valorInicialFormulario,
    abrirCriacao,
    abrirEdicao,
    fecharFormulario,
    salvarFormulario,
    pedirExclusao,
    alternarFavoritoDoRegistro,
    adicionarComentario,
    moverColunaKanban,
    registrarParecerUrgencia,
    salvarNotaPessoal,

    // Itens de campo livre
    anotacaoEmEdicao,
    abrirAnotacao,
    criarNovaAnotacao,
    fecharAnotacao,
    salvarAnotacao,
    pedirExclusaoAnotacao,
  };
}
