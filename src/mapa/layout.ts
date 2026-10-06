import {
  tituloDaAnotacao,
  valoresPreenchidos,
  type Anotacao,
  type Campo,
} from '../data/campos';
import {
  calcularSituacao,
  chaveSetor,
  corPorSituacao,
  rotuloSetor,
  type Registro,
} from '../data/registros';

export type TipoNo = 'raiz' | 'secretaria' | 'setor' | 'competencia' | 'anotacao';

export type NoMapa = {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  subtitulo?: string;
  paiId?: string;
  /** Secretaria/setor: a chave que abre e fecha o nó (ver montarMapa). */
  chave?: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  registro?: Registro;
  /** Preenchido só nos nós de campo livre (tipo 'anotacao'). */
  anotacao?: Anotacao;
  cor: string;
};

export type LigacaoMapa = {
  id: string;
  origemId: string;
  destinoId: string;
};

export const LARGURA_RAIZ = 200;
export const ALTURA_RAIZ = 78;
export const LARGURA_SETOR = 180;
export const ALTURA_SETOR = 68;
export const LARGURA_COMPETENCIA = 220;
export const ALTURA_COMPETENCIA = 88;

const PALETA = ['#7DD3FC', '#C4B5FD', '#6EE7B7', '#FCD34D', '#FCA5A5', '#F9A8D4', '#A5B4FC'];

/** "3 competências · 2 pendentes" — resumo de um grupo de registros. */
const resumoDoGrupo = (grupo: Registro[]): string => {
  const pendentes = grupo.filter((r) => calcularSituacao(r) !== 'aderido').length;
  return `${grupo.length} competência${grupo.length === 1 ? '' : 's'}${
    pendentes ? ` · ${pendentes} pendente${pendentes === 1 ? '' : 's'}` : ''
  }`;
};

/**
 * Espalha `quantidade` filhos num leque voltado para FORA do pai (na direção
 * `angulo`), com raio que cresce junto com o leque para os nós não se
 * encavalarem.
 */
const posicoesEmLeque = (
  pai: { x: number; y: number },
  angulo: number,
  quantidade: number,
  raioMinimo: number,
  espacoPorNo: number,
): { x: number; y: number; angulo: number }[] => {
  const abertura = Math.min(Math.PI * 1.2, Math.max(Math.PI * 0.5, quantidade * 0.18));
  const raio = Math.max(raioMinimo, (quantidade * espacoPorNo) / abertura);

  return Array.from({ length: quantidade }, (_, posicao) => {
    const fracao = quantidade === 1 ? 0.5 : posicao / (quantidade - 1);
    const anguloItem = angulo - abertura / 2 + fracao * abertura;
    return {
      x: pai.x + Math.cos(anguloItem) * raio,
      y: pai.y + Math.sin(anguloItem) * raio,
      angulo: anguloItem,
    };
  });
};

/** Agrupa preservando a ordem da planilha (os setores aparecem como no Excel). */
const agrupar = (lista: Registro[], chave: (r: Registro) => string): Registro[][] => {
  const grupos = new Map<string, Registro[]>();
  lista.forEach((registro) => {
    const k = chave(registro);
    grupos.set(k, [...(grupos.get(k) ?? []), registro]);
  });
  return [...grupos.values()];
};

/**
 * Monta o mapa mental:
 *
 *   Porto Velho (raiz) → Secretarias → Setores → Competências
 *
 * Secretarias e setores abrem e fecham com um toque (as chaves abertas vêm em
 * `expandidos`: "sec:SEMUR", "set:SEMUR|DICI"). Com uma secretaria só (dados
 * de exemplo, ou registros antigos sem secretaria) o nível das secretarias é
 * pulado e a raiz é o departamento, como era antes.
 *
 * O layout é radial e serve apenas como POSIÇÃO INICIAL: o usuário pode
 * arrastar cada nó e a posição dele passa a valer (ver posicoes.ts).
 */
export const montarMapa = (
  registros: Registro[],
  expandidos: Set<string>,
): { nos: NoMapa[]; ligacoes: LigacaoMapa[] } => {
  const nos: NoMapa[] = [];
  const ligacoes: LigacaoMapa[] = [];

  const ligar = (pai: NoMapa, filho: NoMapa) => {
    nos.push(filho);
    ligacoes.push({ id: `lig-${pai.id}-${filho.id}`, origemId: pai.id, destinoId: filho.id });
  };

  const colocarCompetencias = (noSetor: NoMapa, angulo: number, doSetor: Registro[]) => {
    posicoesEmLeque(noSetor, angulo, doSetor.length, 300, ALTURA_COMPETENCIA + 24).forEach(
      (posicao, indice) => {
        const registro = doSetor[indice];
        ligar(noSetor, {
          id: `comp-${registro.id}`,
          tipo: 'competencia',
          rotulo: registro.competencia.slice(0, 60),
          subtitulo: registro.moduloSig || registro.informacoesAcessadas || '',
          paiId: noSetor.id,
          x: posicao.x,
          y: posicao.y,
          largura: LARGURA_COMPETENCIA,
          altura: ALTURA_COMPETENCIA,
          registro,
          cor: corPorSituacao[calcularSituacao(registro)],
        });
      },
    );
  };

  const criarNoSetor = (
    pai: NoMapa,
    doSetor: Registro[],
    posicao: { x: number; y: number; angulo: number },
    cor: string,
  ) => {
    const chave = chaveSetor(doSetor[0]);
    const noSetor: NoMapa = {
      id: `setor-${chave}`,
      tipo: 'setor',
      chave: `set:${chave}`,
      rotulo: rotuloSetor(doSetor[0]),
      subtitulo: resumoDoGrupo(doSetor),
      paiId: pai.id,
      x: posicao.x,
      y: posicao.y,
      largura: LARGURA_SETOR,
      altura: ALTURA_SETOR,
      cor,
    };
    ligar(pai, noSetor);

    if (expandidos.has(`set:${chave}`)) {
      colocarCompetencias(noSetor, posicao.angulo, doSetor);
    }
  };

  const porSecretaria = agrupar(registros, (r) => r.secretaria ?? '');
  const comSecretaria = porSecretaria.length > 1;
  const departamento = registros[0];

  const raiz: NoMapa = {
    id: 'raiz',
    tipo: 'raiz',
    rotulo: comSecretaria ? 'Porto Velho' : departamento?.departamentoSigla || 'Departamento',
    subtitulo: comSecretaria
      ? `${porSecretaria.length} secretarias · ${registros.length} competências`
      : departamento?.departamentoResponsavel || 'Porto Velho',
    x: 0,
    y: 0,
    largura: LARGURA_RAIZ,
    altura: ALTURA_RAIZ,
    cor: '#60A5FA',
  };
  nos.push(raiz);

  if (!comSecretaria) {
    const setores = agrupar(registros, chaveSetor).filter((grupo) => rotuloSetor(grupo[0]));
    const raio = Math.max(320, setores.length * 90);
    setores.forEach((doSetor, indice) => {
      const angulo = (indice / Math.max(setores.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const posicao = { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio, angulo };
      criarNoSetor(raiz, doSetor, posicao, PALETA[indice % PALETA.length]);
    });
    return { nos, ligacoes };
  }

  const raioSecretarias = Math.max(340, porSecretaria.length * 80);

  porSecretaria.forEach((daSecretaria, indice) => {
    const nome = daSecretaria[0].secretaria || 'Sem secretaria';
    const angulo = (indice / porSecretaria.length) * Math.PI * 2 - Math.PI / 2;
    const cor = PALETA[indice % PALETA.length];
    const setores = agrupar(daSecretaria, chaveSetor).filter((grupo) => rotuloSetor(grupo[0]));

    const noSecretaria: NoMapa = {
      id: `sec-${nome}`,
      tipo: 'secretaria',
      chave: `sec:${nome}`,
      rotulo: nome,
      subtitulo: `${setores.length} setor${setores.length === 1 ? '' : 'es'} · ${resumoDoGrupo(
        daSecretaria,
      )}`,
      paiId: raiz.id,
      x: Math.cos(angulo) * raioSecretarias,
      y: Math.sin(angulo) * raioSecretarias,
      largura: LARGURA_SETOR,
      altura: ALTURA_SETOR,
      cor,
    };
    ligar(raiz, noSecretaria);

    if (!expandidos.has(`sec:${nome}`)) {
      return;
    }

    posicoesEmLeque(noSecretaria, angulo, setores.length, 340, ALTURA_SETOR + 28).forEach(
      (posicao, posicaoSetor) => criarNoSetor(noSecretaria, setores[posicaoSetor], posicao, cor),
    );
  });

  return { nos, ligacoes };
};

/**
 * Mapa de um campo livre: a raiz e o nome do cofre, e cada item cadastrado
 * vira um no ao redor.
 *
 * Nao ha nivel intermediario aqui porque um campo livre nao tem hierarquia
 * definida — o formulario dele e uma lista de perguntas, nao uma lotacao.
 */
export const montarMapaDeAnotacoes = (
  campo: Campo,
  anotacoes: Anotacao[],
): { nos: NoMapa[]; ligacoes: LigacaoMapa[] } => {
  const raiz: NoMapa = {
    // O id leva o campo junto porque as posicoes arrastadas sao guardadas num
    // mapa unico por id: uma raiz chamada so 'raiz' faria todos os cofres
    // compartilharem a mesma posicao.
    id: `raiz-${campo.id}`,
    tipo: 'raiz',
    rotulo: campo.nome,
    subtitulo: `${anotacoes.length} ${anotacoes.length === 1 ? 'item' : 'itens'}`,
    x: 0,
    y: 0,
    largura: LARGURA_RAIZ,
    altura: ALTURA_RAIZ,
    cor: '#60A5FA',
  };

  const nos: NoMapa[] = [raiz];
  const ligacoes: LigacaoMapa[] = [];

  const raio = Math.max(320, anotacoes.length * 70);

  anotacoes.forEach((anotacao, indice) => {
    const angulo = (indice / Math.max(anotacoes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    // O segundo valor preenchido serve de subtitulo — o primeiro ja e o titulo.
    const [, segundo] = valoresPreenchidos(campo, anotacao);

    const no: NoMapa = {
      id: `anot-${anotacao.id}`,
      tipo: 'anotacao',
      rotulo: tituloDaAnotacao(campo, anotacao).slice(0, 60),
      subtitulo: segundo ? `${segundo.requisito.rotulo}: ${segundo.texto}`.slice(0, 60) : '',
      paiId: raiz.id,
      x: Math.cos(angulo) * raio,
      y: Math.sin(angulo) * raio,
      largura: LARGURA_COMPETENCIA,
      altura: ALTURA_COMPETENCIA,
      anotacao,
      cor: PALETA[indice % PALETA.length],
    };

    nos.push(no);
    ligacoes.push({ id: `lig-${raiz.id}-${no.id}`, origemId: raiz.id, destinoId: no.id });
  });

  return { nos, ligacoes };
};

/**
 * Ligacoes extras entre competencias de setores diferentes que compartilham a
 * MESMA CAMADA do SIG — e o "vinculo por campo semelhante": mostra quem depende
 * do mesmo dado e, portanto, precisa do mesmo acesso.
 */
export const ligacoesPorCamada = (nos: NoMapa[]): LigacaoMapa[] => {
  const competencias = nos.filter((no) => no.tipo === 'competencia' && no.registro);
  const porCamada = new Map<string, NoMapa[]>();

  competencias.forEach((no) => {
    const camada = (no.registro?.informacoesAcessadas ?? '').toLowerCase().trim();
    if (!camada || camada === 'nenhuma') {
      return;
    }
    porCamada.set(camada, [...(porCamada.get(camada) ?? []), no]);
  });

  const ligacoes: LigacaoMapa[] = [];

  porCamada.forEach((grupo) => {
    if (grupo.length < 2) {
      return;
    }

    // Liga em cadeia (a→b→c) em vez de todos-com-todos, para nao poluir a tela.
    for (let i = 0; i < grupo.length - 1; i += 1) {
      const origem = grupo[i];
      const destino = grupo[i + 1];
      const setorOrigem = origem.registro ? chaveSetor(origem.registro) : '';
      const setorDestino = destino.registro ? chaveSetor(destino.registro) : '';

      if (setorOrigem !== setorDestino) {
        ligacoes.push({
          id: `camada-${origem.id}-${destino.id}`,
          origemId: origem.id,
          destinoId: destino.id,
        });
      }
    }
  });

  return ligacoes;
};
