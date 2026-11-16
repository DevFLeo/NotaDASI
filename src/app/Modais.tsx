import React from 'react';
import DetalheRegistro from '../components/DetalheRegistro';
import FormularioAnotacao from '../components/FormularioAnotacao';
import FormularioRegistro from '../components/FormularioRegistro';
import LimiteDeErro from '../components/LimiteDeErro';
import MenuCampos from '../components/MenuCampos';
import { useSessao } from '../auth/useSessao';
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
  const { contaAtual } = useSessao();

  // Extraídos antes do JSX: dentro de uma arrow o TypeScript perde o
  // estreitamento de `app.formulario?.modo === 'editar'` e exigiria um `!`.
  const anotacaoEmEdicao =
    app.anotacaoEmEdicao?.modo === 'editar' ? app.anotacaoEmEdicao.anotacao : null;
  const registroEmEdicao = app.formulario?.modo === 'editar' ? app.formulario.registro : null;

  const lidarComentario = (id: string, texto: string) => {
    if (!contaAtual) return;
    app.adicionarComentario(id, {
      usuario: contaAtual.usuario,
      nome: contaAtual.nome,
      papel: contaAtual.papel,
      texto,
    });
  };

  const lidarNotaPessoal = (id: string, texto: string) => {
    if (!contaAtual) return;
    app.salvarNotaPessoal(id, contaAtual.usuario, texto);
  };

  return (
    <>
      {app.selecionado ? (
        <LimiteDeErro aoResetar={() => app.setSelecionado(null)} titulo="Erro ao abrir detalhes">
          <DetalheRegistro
            key={`detalhe-${app.selecionado.id}-${app.selecionado._stamp ?? 0}`}
            registro={app.selecionado}
            aoFechar={() => app.setSelecionado(null)}
            aoEditar={app.abrirEdicao}
            aoExcluir={app.pedirExclusao}
            aoAlternarFavorito={app.alternarFavoritoDoRegistro}
            aoAdicionarComentario={lidarComentario}
            aoSalvarNotaPessoal={lidarNotaPessoal}
            aoNavegarAnterior={app.posicaoSelecionado.total > 1 ? app.navegarRegistroAnterior : undefined}
            aoNavegarProximo={app.posicaoSelecionado.total > 1 ? app.navegarProximoRegistro : undefined}
            indiceNoSetor={app.posicaoSelecionado.indice}
            totalNoSetor={app.posicaoSelecionado.total}
          />
        </LimiteDeErro>
      ) : null}

      {ocultarMenuCampos ? null : (
        <LimiteDeErro aoResetar={app.fecharMenuCampos} titulo="Erro ao abrir menu de campos">
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
        </LimiteDeErro>
      )}

      <LimiteDeErro aoResetar={app.fecharAnotacao} titulo="Erro no formulário de anotação">
        <FormularioAnotacao
          visivel={app.anotacaoEmEdicao !== null}
          campo={app.campoAtivo}
          anotacao={anotacaoEmEdicao}
          aoSalvar={app.salvarAnotacao}
          aoCancelar={app.fecharAnotacao}
          aoExcluir={anotacaoEmEdicao ? () => app.pedirExclusaoAnotacao(anotacaoEmEdicao) : undefined}
        />
      </LimiteDeErro>

      <LimiteDeErro aoResetar={app.fecharFormulario} titulo="Erro no formulário de competência">
        <FormularioRegistro
          visivel={app.formulario !== null}
          tituloModal={app.formulario?.modo === 'editar' ? 'Editar competência' : 'Nova competência'}
          valorInicial={app.valorInicialFormulario}
          aoSalvar={app.salvarFormulario}
          aoCancelar={app.fecharFormulario}
          aoExcluir={registroEmEdicao ? () => app.pedirExclusao(registroEmEdicao) : undefined}
          aoAdicionarComentario={
            registroEmEdicao ? (texto) => lidarComentario(registroEmEdicao.id, texto) : undefined
          }
        />
      </LimiteDeErro>
    </>
  );
};

export default Modais;
