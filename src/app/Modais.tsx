import React from 'react';
import DetalheRegistro from '../components/DetalheRegistro';
import FormularioAnotacao from '../components/FormularioAnotacao';
import FormularioRegistro from '../components/FormularioRegistro';
import MenuCampos from '../components/MenuCampos';
import type { Aplicacao } from './useAplicacao';

type Props = {
  app: Aplicacao;
  /**
   * O PC mostra o menu de campos EMBUTIDO no painel de 35% (ver
   * pc/CascaPC.tsx), não como folha que sobe. Nesse caso a casca pede para não
   * repetir o modal aqui — senão os dois abririam ao mesmo tempo.
   */
  ocultarMenuCampos?: boolean;
};

/**
 * As camadas que ficam POR CIMA de qualquer tela: detalhe, formulários e o
 * menu de campos.
 *
 * São iguais no celular e no PC de propósito. Um formulário de competência não
 * muda de regra por causa do tamanho da tela — o que muda é a casca ao redor
 * (abas embaixo x barra lateral), e essa parte cada plataforma desenha por si.
 */
export const Modais: React.FC<Props> = ({ app, ocultarMenuCampos = false }) => {
  // Extraídos antes do JSX: dentro de uma arrow o TypeScript perde o
  // estreitamento de `app.formulario?.modo === 'editar'` e exigiria um `!`.
  const anotacaoEmEdicao =
    app.anotacaoEmEdicao?.modo === 'editar' ? app.anotacaoEmEdicao.anotacao : null;
  const registroEmEdicao = app.formulario?.modo === 'editar' ? app.formulario.registro : null;

  return (
    <>
      <DetalheRegistro
        registro={app.selecionado}
        aoFechar={() => app.setSelecionado(null)}
        aoEditar={app.abrirEdicao}
        aoExcluir={app.pedirExclusao}
        aoAlternarFavorito={app.alternarFavoritoDoRegistro}
      />

      {ocultarMenuCampos ? null : (
        <MenuCampos
          visivel={app.menuCampos}
          campos={app.campos}
          campoAtivo={app.campoAtivo}
          contarItens={app.contarItens}
          aoFechar={app.fecharMenuCampos}
          aoTrocar={app.definirCampoAtivo}
          aoCriar={app.criarCampo}
          aoAtualizar={app.atualizarCampo}
          aoExcluir={app.excluirCampo}
        />
      )}

      <FormularioAnotacao
        visivel={app.anotacaoEmEdicao !== null}
        campo={app.campoAtivo}
        anotacao={anotacaoEmEdicao}
        aoSalvar={app.salvarAnotacao}
        aoCancelar={app.fecharAnotacao}
        aoExcluir={anotacaoEmEdicao ? () => app.pedirExclusaoAnotacao(anotacaoEmEdicao) : undefined}
      />

      <FormularioRegistro
        visivel={app.formulario !== null}
        tituloModal={app.formulario?.modo === 'editar' ? 'Editar competência' : 'Nova competência'}
        valorInicial={app.valorInicialFormulario}
        aoSalvar={app.salvarFormulario}
        aoCancelar={app.fecharFormulario}
        aoExcluir={registroEmEdicao ? () => app.pedirExclusao(registroEmEdicao) : undefined}
      />
    </>
  );
};

export default Modais;
