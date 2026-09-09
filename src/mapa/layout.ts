import { calcularSituacao, corPorSituacao, type Registro } from '../data/registros';

export type TipoNo = 'raiz' | 'setor' | 'competencia';

export type NoMapa = {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  subtitulo?: string;
  paiId?: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  registro?: Registro;
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

/**
 * Monta o mapa mental em tres niveis:
 *
 *   Departamento (raiz) → Setores → Competencias
 *
 * O layout e radial e serve apenas como POSICAO INICIAL: o usuario pode
 * arrastar cada no e a posicao dele passa a valer (ver posicoes.ts).
 */
export const montarMapa = (
  registros: Registro[],
  setoresExpandidos: Set<string>,
): { nos: NoMapa[]; ligacoes: LigacaoMapa[] } => {
  const nos: NoMapa[] = [];
  const ligacoes: LigacaoMapa[] = [];

  const departamento = registros[0];

  const raiz: NoMapa = {
    id: 'raiz',
    tipo: 'raiz',
    rotulo: departamento?.departamentoSigla || 'Departamento',
    subtitulo: departamento?.departamentoResponsavel || 'Porto Velho',
    x: 0,
    y: 0,
    largura: LARGURA_RAIZ,
    altura: ALTURA_RAIZ,
    cor: '#60A5FA',
  };
  nos.push(raiz);

  const siglas = [...new Set(registros.map((r) => r.setorSigla || r.setor))].filter(Boolean).sort();

  const raioSetores = Math.max(320, siglas.length * 90);

  siglas.forEach((sigla, indice) => {
    const angulo = (indice / Math.max(siglas.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const cor = PALETA[indice % PALETA.length];

    const doSetor = registros.filter((r) => (r.setorSigla || r.setor) === sigla);
    const pendentes = doSetor.filter((r) => calcularSituacao(r) !== 'aderido').length;

    const noSetor: NoMapa = {
      id: `setor-${sigla}`,
      tipo: 'setor',
      rotulo: sigla,
      subtitulo: `${doSetor.length} competência${doSetor.length === 1 ? '' : 's'}${
        pendentes ? ` · ${pendentes} pendente${pendentes === 1 ? '' : 's'}` : ''
      }`,
      paiId: raiz.id,
      x: Math.cos(angulo) * raioSetores,
      y: Math.sin(angulo) * raioSetores,
      largura: LARGURA_SETOR,
      altura: ALTURA_SETOR,
      cor,
    };

    nos.push(noSetor);
    ligacoes.push({ id: `lig-${raiz.id}-${noSetor.id}`, origemId: raiz.id, destinoId: noSetor.id });

    if (!setoresExpandidos.has(sigla)) {
      return;
    }

    const raioCompetencias = 300;
    const abertura = Math.PI * 0.8;

    doSetor.forEach((registro, posicao) => {
      const fracao = doSetor.length === 1 ? 0.5 : posicao / (doSetor.length - 1);
      const anguloItem = angulo - abertura / 2 + fracao * abertura;

      const noCompetencia: NoMapa = {
        id: `comp-${registro.id}`,
        tipo: 'competencia',
        rotulo: registro.competencia.slice(0, 60),
        subtitulo: registro.moduloSig || registro.informacoesAcessadas || '',
        paiId: noSetor.id,
        x: noSetor.x + Math.cos(anguloItem) * raioCompetencias,
        y: noSetor.y + Math.sin(anguloItem) * raioCompetencias,
        largura: LARGURA_COMPETENCIA,
        altura: ALTURA_COMPETENCIA,
        registro,
        cor: corPorSituacao[calcularSituacao(registro)],
      };

      nos.push(noCompetencia);
      ligacoes.push({
        id: `lig-${noSetor.id}-${noCompetencia.id}`,
        origemId: noSetor.id,
        destinoId: noCompetencia.id,
      });
    });
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
      const setorOrigem = origem.registro?.setorSigla ?? '';
      const setorDestino = destino.registro?.setorSigla ?? '';

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
