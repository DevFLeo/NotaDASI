/**
 * "Campos" são cofres separados, no sentido do Obsidian: cada um guarda os
 * próprios itens e o próprio formulário de cadastro, e nada atravessa de um
 * para o outro.
 *
 * Existem dois tipos:
 *
 * - `sig`   : o campo embutido "Acompanhamento do SIG". É o padrão, o único
 *             que existe numa instalação nova, e tem formulário FIXO (o
 *             levantamento de competências, ver data/registros.ts). Não pode
 *             ser excluído nem ter o formulário alterado.
 * - `livre` : criado pelo usuário. Ele define ali os requisitos do cadastro
 *             (quais perguntas o formulário vai ter e de que tipo); começa com
 *             Título + Anotação e cresce dali.
 */

export type TipoDeDado = 'texto' | 'texto-longo' | 'numero' | 'sim-nao' | 'data';

export const ROTULO_TIPO: Record<TipoDeDado, string> = {
  texto: 'Texto',
  'texto-longo': 'Texto longo',
  numero: 'Número',
  'sim-nao': 'Sim / Não',
  data: 'Data',
};

/** Uma pergunta do formulário de um campo livre. */
export type RequisitoCampo = {
  id: string;
  rotulo: string;
  tipo: TipoDeDado;
  obrigatorio: boolean;
};

export type Campo = {
  id: string;
  nome: string;
  tipo: 'sig' | 'livre';
  /** Vazio no campo do SIG, que usa o formulário fixo de competências. */
  formulario: RequisitoCampo[];
  criadoEm: string;
};

/** Um item cadastrado dentro de um campo livre. */
export type Anotacao = {
  id: string;
  campoId: string;
  /** Chaveado pelo id do requisito — booleano só em requisitos 'sim-nao'. */
  valores: Record<string, string | boolean | undefined>;
  criadoEm: string;
  atualizadoEm: string;
};

export const ID_CAMPO_SIG = 'sig';

export const CAMPO_SIG: Campo = {
  id: ID_CAMPO_SIG,
  nome: 'Acompanhamento do SIG',
  tipo: 'sig',
  formulario: [],
  criadoEm: '',
};

export const gerarIdCampo = (): string =>
  `campo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const gerarIdRequisito = (): string =>
  `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const gerarIdAnotacao = (): string =>
  `anot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Todo campo livre nasce com estes dois requisitos — é o mínimo para o item
 * ter um nome na lista e no mapa. O usuário pode renomeá-los ou acrescentar
 * outros, mas não remover o primeiro: sem título, o cartão fica anônimo.
 */
export const formularioPadrao = (): RequisitoCampo[] => [
  { id: gerarIdRequisito(), rotulo: 'Título', tipo: 'texto', obrigatorio: true },
  { id: gerarIdRequisito(), rotulo: 'Anotação', tipo: 'texto-longo', obrigatorio: false },
];

/** O primeiro requisito é o que dá nome ao item na lista e no mapa. */
export const requisitoTitulo = (campo: Campo): RequisitoCampo | undefined => campo.formulario[0];

export const textoDoValor = (valor: string | boolean | undefined): string => {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return (valor ?? '').toString();
};

export const tituloDaAnotacao = (campo: Campo, anotacao: Anotacao): string => {
  const requisito = requisitoTitulo(campo);
  const valor = requisito ? textoDoValor(anotacao.valores[requisito.id]).trim() : '';
  return valor || 'Sem título';
};

/** Tudo que o item contém, em uma string — usado pela busca da lista e do mapa. */
export const textoPesquisavelDaAnotacao = (campo: Campo, anotacao: Anotacao): string =>
  campo.formulario
    .map((requisito) => `${requisito.rotulo} ${textoDoValor(anotacao.valores[requisito.id])}`)
    .join(' ');

/** Requisitos preenchidos, na ordem do formulário — o que o cartão mostra. */
export const valoresPreenchidos = (
  campo: Campo,
  anotacao: Anotacao,
): { requisito: RequisitoCampo; texto: string }[] =>
  campo.formulario
    .map((requisito) => ({ requisito, texto: textoDoValor(anotacao.valores[requisito.id]).trim() }))
    .filter((item) => item.texto.length > 0);

/** Requisitos obrigatórios ainda em branco — o formulário barra o salvamento. */
export const requisitosFaltando = (
  campo: Campo,
  valores: Anotacao['valores'],
): RequisitoCampo[] =>
  campo.formulario.filter(
    (requisito) => requisito.obrigatorio && textoDoValor(valores[requisito.id]).trim().length === 0,
  );
