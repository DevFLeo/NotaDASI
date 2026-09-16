import {
  calcularSituacao,
  corPorSituacao,
  type Registro,
  type SituacaoAdesao,
} from '../../../src/data/registros';
import {
  chaveAlvo,
  idDaDivisao,
  idDaPessoa,
  idDoDepartamento,
  iconeTipoDocumento,
  rotuloTipoDocumento,
  type Documento,
} from '../../../src/data/documentos';

export type TipoNo = 'raiz' | 'divisao' | 'pessoa' | 'competencia' | 'documento';

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
  cor: string;
  /** Quantos documentos estao alocados a este no (departamento, divisao ou pessoa). */
  documentos: number;
  /** Chave do alvo (ex.: "divisao:dici") para anexar documento direto pelo no. */
  alvo?: string;
  registro?: Registro;
  documento?: Documento;
  situacao?: SituacaoAdesao;
  recolhivel: boolean;
  recolhido: boolean;
  filhosOcultos: number;
};

export type LigacaoMapa = {
  id: string;
  origemId: string;
  destinoId: string;
  tipo: 'hierarquia' | 'camada' | 'documento';
};

export const TAMANHOS: Record<TipoNo, { largura: number; altura: number }> = {
  raiz: { largura: 220, altura: 84 },
  divisao: { largura: 200, altura: 78 },
  pessoa: { largura: 200, altura: 78 },
  competencia: { largura: 244, altura: 96 },
  documento: { largura: 204, altura: 70 },
};

const PALETA = ['#7DD3FC', '#C4B5FD', '#6EE7B7', '#FCD34D', '#FCA5A5', '#F9A8D4', '#A5B4FC'];

/** Raio de cada nivel. Cresce conforme o mapa fica mais cheio. */
const raiosPorFolhas = (folhas: number): number[] => {
  const base = Math.max(340, folhas * 36);
  return [0, base, base * 1.8, base * 2.65, base * 3.4];
};

type Arvore = {
  no: NoMapa;
  filhos: Arvore[];
};

type NoParcial = Partial<NoMapa> & Pick<NoMapa, 'id' | 'tipo' | 'rotulo' | 'cor'>;

const criarNo = (parcial: NoParcial): NoMapa => ({
  x: 0,
  y: 0,
  largura: TAMANHOS[parcial.tipo].largura,
  altura: TAMANHOS[parcial.tipo].altura,
  documentos: 0,
  recolhivel: false,
  recolhido: false,
  filhosOcultos: 0,
  ...parcial,
});

export type OpcoesMapa = {
  registros: Registro[];
  documentos: Documento[];
  /** Ids de nos recolhidos (divisoes e pessoas). */
  recolhidos: Set<string>;
  /** Situacoes visiveis; conjunto vazio = todas. */
  situacoes: Set<SituacaoAdesao>;
  /** Mostra os nos de documento no mapa. */
  mostrarDocumentos: boolean;
  /** Texto da busca (realce, nao filtro). */
  busca: string;
};

export type ResultadoMapa = {
  nos: NoMapa[];
  ligacoes: LigacaoMapa[];
  /** Ids dos nos que casam com a busca. */
  encontrados: Set<string>;
  /** Pai de cada no, para calcular foco/subarvore. */
  paiDe: Map<string, string>;
};

export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const documentoParaNo = (documento: Documento, paiId: string): NoMapa =>
  criarNo({
    id: `docno-${documento.id}`,
    tipo: 'documento',
    rotulo: `${iconeTipoDocumento[documento.tipo]} ${documento.titulo}`,
    subtitulo: `${rotuloTipoDocumento[documento.tipo]}${
      documento.arquivoNome ? ` · ${documento.arquivoNome}` : documento.url ? ' · link externo' : ''
    }`,
    paiId,
    cor: '#FDE68A',
    documento,
  });

/**
 * Monta o mapa em QUATRO niveis, mais os documentos:
 *
 *   Departamento -> Divisao -> Pessoa -> Competencia
 *        |             |         |
 *        +- documentos +- docs   +- docs da pessoa
 *
 * O posicionamento e radial "tidy": cada ramo recebe uma fatia de angulo
 * proporcional ao numero de folhas que carrega, entao ramos grandes nao
 * atropelam os pequenos (o layout antigo dava a mesma fatia para todo mundo).
 */
export const montarMapa = ({
  registros,
  documentos,
  recolhidos,
  situacoes,
  mostrarDocumentos,
  busca,
}: OpcoesMapa): ResultadoMapa => {
  const porAlvo = new Map<string, Documento[]>();
  documentos.forEach((doc) => {
    const chave = chaveAlvo(doc.alvoTipo, doc.alvoId);
    porAlvo.set(chave, [...(porAlvo.get(chave) ?? []), doc]);
  });

  const visiveis = situacoes.size
    ? registros.filter((registro) => situacoes.has(calcularSituacao(registro)))
    : registros;

  const primeiro = registros[0];
  const chaveDepartamento = primeiro ? chaveAlvo('departamento', idDoDepartamento(primeiro)) : '';
  const docsDepartamento = porAlvo.get(chaveDepartamento) ?? [];

  const raiz = criarNo({
    id: 'raiz',
    tipo: 'raiz',
    rotulo: primeiro?.departamentoSigla || 'Departamento',
    subtitulo: primeiro?.departamentoResponsavel || 'Porto Velho',
    cor: '#60A5FA',
    documentos: docsDepartamento.length,
    alvo: chaveDepartamento,
  });

  const arvore: Arvore = { no: raiz, filhos: [] };

  if (mostrarDocumentos) {
    docsDepartamento.forEach((doc) => {
      arvore.filhos.push({ no: documentoParaNo(doc, raiz.id), filhos: [] });
    });
  }

  const siglas = [...new Set(visiveis.map((r) => r.setorSigla || r.setor))].filter(Boolean).sort();

  siglas.forEach((sigla, indice) => {
    const doSetor = visiveis.filter((r) => (r.setorSigla || r.setor) === sigla);
    const cor = PALETA[indice % PALETA.length];
    const idDiv = idDaDivisao(doSetor[0]);
    const alvoDiv = chaveAlvo('divisao', idDiv);
    const docsDiv = porAlvo.get(alvoDiv) ?? [];

    const pendentes = doSetor.filter((r) => calcularSituacao(r) !== 'aderido').length;
    const pessoas = [...new Set(doSetor.map((r) => r.responsavel))].filter(Boolean).sort();

    const idNoDivisao = `divisao-${idDiv}`;
    const recolhida = recolhidos.has(idNoDivisao);

    const noDivisao = criarNo({
      id: idNoDivisao,
      tipo: 'divisao',
      rotulo: sigla,
      subtitulo: `${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'} · ${doSetor.length} comp.${
        pendentes ? ` · ${pendentes} pendente${pendentes === 1 ? '' : 's'}` : ''
      }`,
      paiId: raiz.id,
      cor,
      documentos: docsDiv.length,
      alvo: alvoDiv,
      recolhivel: true,
      recolhido: recolhida,
    });

    const ramoDivisao: Arvore = { no: noDivisao, filhos: [] };
    arvore.filhos.push(ramoDivisao);

    if (recolhida) {
      noDivisao.filhosOcultos = pessoas.length + (mostrarDocumentos ? docsDiv.length : 0);
      return;
    }

    if (mostrarDocumentos) {
      docsDiv.forEach((doc) => {
        ramoDivisao.filhos.push({ no: documentoParaNo(doc, noDivisao.id), filhos: [] });
      });
    }

    pessoas.forEach((nome) => {
      const daPessoa = doSetor.filter((r) => r.responsavel === nome);
      const idPes = idDaPessoa(daPessoa[0]);
      const alvoPes = chaveAlvo('pessoa', idPes);
      const docsPes = porAlvo.get(alvoPes) ?? [];
      const idNoPessoa = `pessoa-${idDiv}-${idPes}`;
      const pessoaRecolhida = recolhidos.has(idNoPessoa);

      const noPessoa = criarNo({
        id: idNoPessoa,
        tipo: 'pessoa',
        rotulo: nome,
        subtitulo: `${daPessoa[0].cargo || 'Servidor(a)'} · ${daPessoa.length} competência${
          daPessoa.length === 1 ? '' : 's'
        }`,
        paiId: noDivisao.id,
        cor,
        documentos: docsPes.length,
        alvo: alvoPes,
        recolhivel: true,
        recolhido: pessoaRecolhida,
      });

      const ramoPessoa: Arvore = { no: noPessoa, filhos: [] };
      ramoDivisao.filhos.push(ramoPessoa);

      if (pessoaRecolhida) {
        noPessoa.filhosOcultos = daPessoa.length + (mostrarDocumentos ? docsPes.length : 0);
        return;
      }

      if (mostrarDocumentos) {
        docsPes.forEach((doc) => {
          ramoPessoa.filhos.push({ no: documentoParaNo(doc, noPessoa.id), filhos: [] });
        });
      }

      daPessoa.forEach((registro) => {
        const situacao = calcularSituacao(registro);
        ramoPessoa.filhos.push({
          no: criarNo({
            id: `comp-${registro.id}`,
            tipo: 'competencia',
            rotulo: registro.competencia,
            subtitulo: registro.moduloSig || registro.informacoesAcessadas || '',
            paiId: noPessoa.id,
            cor: corPorSituacao[situacao],
            registro,
            situacao,
          }),
          filhos: [],
        });
      });
    });
  });

  // ---- posicionamento radial proporcional --------------------------------
  const contarFolhas = (ramo: Arvore): number =>
    ramo.filhos.length ? ramo.filhos.reduce((total, filho) => total + contarFolhas(filho), 0) : 1;

  const raios = raiosPorFolhas(contarFolhas(arvore));

  const posicionar = (ramo: Arvore, inicio: number, fim: number, nivel: number) => {
    const angulo = (inicio + fim) / 2;
    const raio = raios[Math.min(nivel, raios.length - 1)];
    ramo.no.x = Math.cos(angulo) * raio;
    ramo.no.y = Math.sin(angulo) * raio;

    const folhas = contarFolhas(ramo);
    let cursor = inicio;

    ramo.filhos.forEach((filho) => {
      const fatia = ((fim - inicio) * contarFolhas(filho)) / folhas;
      posicionar(filho, cursor, cursor + fatia, nivel + 1);
      cursor += fatia;
    });
  };

  posicionar(arvore, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  // ---- achatar a arvore --------------------------------------------------
  const nos: NoMapa[] = [];
  const ligacoes: LigacaoMapa[] = [];
  const paiDe = new Map<string, string>();

  const achatar = (ramo: Arvore) => {
    nos.push(ramo.no);
    ramo.filhos.forEach((filho) => {
      paiDe.set(filho.no.id, ramo.no.id);
      ligacoes.push({
        id: `lig-${ramo.no.id}-${filho.no.id}`,
        origemId: ramo.no.id,
        destinoId: filho.no.id,
        tipo: filho.no.tipo === 'documento' ? 'documento' : 'hierarquia',
      });
      achatar(filho);
    });
  };

  achatar(arvore);

  // ---- busca (realce, nao filtro) ---------------------------------------
  const alvoBusca = normalizar(busca.trim());
  const encontrados = new Set<string>();

  if (alvoBusca.length >= 2) {
    nos.forEach((no) => {
      const texto = normalizar(
        [
          no.rotulo,
          no.subtitulo ?? '',
          no.registro?.comoAtende ?? '',
          no.registro?.observacao ?? '',
          no.documento?.descricao ?? '',
        ].join(' '),
      );
      if (texto.includes(alvoBusca)) {
        encontrados.add(no.id);
      }
    });
  }

  return { nos, ligacoes, encontrados, paiDe };
};

/**
 * Ligacoes extras entre competencias de DIVISOES diferentes que usam a mesma
 * camada do SIG: mostra quem depende do mesmo dado (e do mesmo acesso).
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
    for (let i = 0; i < grupo.length - 1; i += 1) {
      const origem = grupo[i];
      const destino = grupo[i + 1];
      if (origem.registro?.setorSigla !== destino.registro?.setorSigla) {
        ligacoes.push({
          id: `camada-${origem.id}-${destino.id}`,
          origemId: origem.id,
          destinoId: destino.id,
          tipo: 'camada',
        });
      }
    }
  });

  return ligacoes;
};

/**
 * O no, a linha de ancestrais ate a raiz e TODOS os descendentes dele.
 *
 * Os irmaos dos ancestrais ficam de fora de proposito — e isso que faz o modo
 * foco esmaecer o resto do mapa em vez de acender a arvore inteira.
 */
export const subarvoreEAncestrais = (id: string, paiDe: Map<string, string>): Set<string> => {
  const relacionados = new Set<string>([id]);

  let atual = paiDe.get(id);
  while (atual && !relacionados.has(atual)) {
    relacionados.add(atual);
    atual = paiDe.get(atual);
  }

  const filhosDe = new Map<string, string[]>();
  paiDe.forEach((pai, filho) => {
    filhosDe.set(pai, [...(filhosDe.get(pai) ?? []), filho]);
  });

  const fila = [id];
  while (fila.length) {
    const noAtual = fila.pop() as string;
    (filhosDe.get(noAtual) ?? []).forEach((filho) => {
      if (!relacionados.has(filho)) {
        relacionados.add(filho);
        fila.push(filho);
      }
    });
  }

  return relacionados;
};
