import {
  tituloDaAnotacao,
  valoresPreenchidos,
  type Anotacao,
  type Campo,
} from '../data/campos';
import type { ContatoIntegrado } from '../data/contatosIntegrados';
import { calcularSituacao, corPorSituacao, type Registro } from '../data/registros';

export type TipoNo = 'raiz' | 'setor' | 'competencia' | 'anotacao' | 'contato';

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
  /** Preenchido só nos nós de campo livre (tipo 'anotacao'). */
  anotacao?: Anotacao;
  /** Preenchido só nos nós do mapa de contatos (tipo 'contato'). */
  contato?: ContatoIntegrado;
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
 * Mapeia qualquer registro da base para sua respectiva SECRETARIA oficial
 * da Prefeitura Municipal de Porto Velho.
 */
export const mapearSecretaria = (
  r: Registro,
): { sigla: string; nome: string; departamentoPrincipal?: string } => {
  const dSigla = (r.departamentoSigla || '').toUpperCase();
  const dNome = (r.departamento || '').toUpperCase();

  if (dSigla.includes('SEMFAZ') || dNome.includes('FAZENDA')) {
    return { sigla: 'SEMFAZ', nome: 'Secretaria Municipal de Fazenda', departamentoPrincipal: 'DCF' };
  }
  if (
    dSigla.includes('SEMUR') ||
    dSigla === 'DRCF' ||
    dNome.includes('FUNDIÁRI') ||
    dNome.includes('REGULARIZAÇÃO')
  ) {
    return {
      sigla: 'SEMUR',
      nome: 'Sec. Municipal de Regularização Fundiária e Habitação',
      departamentoPrincipal: 'DRCF',
    };
  }
  if (dSigla.includes('SEMUSB') || dNome.includes('SANEAMENTO') || dNome.includes('POSTURAS')) {
    return {
      sigla: 'SEMUSB',
      nome: 'Sec. Municipal de Saneamento e Serviços Básicos',
      departamentoPrincipal: 'Posturas',
    };
  }
  if (dSigla.includes('SEMA') || dNome.includes('MEIO AMBIENTE')) {
    return {
      sigla: 'SEMA',
      nome: 'Sec. Municipal de Meio Ambiente e Desenv. Sustentável',
      departamentoPrincipal: 'DEFIS',
    };
  }
  if (dSigla.includes('SEMTRAN') || dNome.includes('TRÂNSITO') || dNome.includes('TRANSPORTES')) {
    return { sigla: 'SEMTRAN', nome: 'Sec. Municipal de Trânsito, Mobilidade e Transportes' };
  }
  if (dSigla.includes('SEMUSA') || dNome.includes('SAÚDE')) {
    return { sigla: 'SEMUSA', nome: 'Secretaria Municipal de Saúde', departamentoPrincipal: 'DAB' };
  }
  if (dSigla.includes('SEMED') || dNome.includes('EDUCAÇÃO')) {
    return { sigla: 'SEMED', nome: 'Secretaria Municipal de Educação', departamentoPrincipal: 'DPE' };
  }
  if (dSigla.includes('SEINFRA') || dNome.includes('INFRAESTRUTURA') || dNome.includes('OBRAS')) {
    return { sigla: 'SEINFRA', nome: 'Secretaria Municipal de Infraestrutura', departamentoPrincipal: 'DOC' };
  }
  if (dSigla.includes('SEMAGRIC') || dNome.includes('AGRICULTURA')) {
    return { sigla: 'SEMAGRIC', nome: 'Secretaria Municipal de Agricultura' };
  }
  if (dSigla.includes('SEMIAS') || dNome.includes('ASSISTÊNCIA SOCIAL')) {
    return { sigla: 'SEMIAS', nome: 'Secretaria Municipal de Assistência Social' };
  }
  if (dSigla.includes('SEMAD') || dNome.includes('ADMINISTRAÇÃO')) {
    return { sigla: 'SEMAD', nome: 'Secretaria Municipal de Administração' };
  }
  if (dSigla.includes('SEMPOG') || dNome.includes('PLANEJAMENTO')) {
    return { sigla: 'SEMPOG', nome: 'Sec. Municipal de Planejamento, Orçamento e Gestão' };
  }
  return {
    sigla: r.departamentoSigla || 'SEC',
    nome: r.departamento || 'Secretaria Municipal',
  };
};

/**
 * Monta o mapa mental focado EXCLUSIVAMENTE nas SECRETARIAS municipais:
 *
 *   Visão Geral: Anel elegante com SÓ AS SECRETARIAS (sem nó central "Prefeitura PVH"
 *   nem teia de aranha com dezenas de linhas radiando).
 *
 *   Ao clicar numa Secretaria: expande os seus setores/divisões ou competências.
 */
export const montarMapa = (
  registros: Registro[],
  setoresExpandidos: Set<string>,
): { nos: NoMapa[]; ligacoes: LigacaoMapa[] } => {
  const nos: NoMapa[] = [];
  const ligacoes: LigacaoMapa[] = [];

  if (!registros.length) return { nos, ligacoes };

  // Agrupa os registros por SECRETARIA
  const secretariasMap = new Map<
    string,
    { nome: string; departamentoPrincipal?: string; registros: Registro[] }
  >();

  registros.forEach((r) => {
    const { sigla, nome, departamentoPrincipal } = mapearSecretaria(r);
    const atual = secretariasMap.get(sigla) || { nome, departamentoPrincipal, registros: [] };
    atual.registros.push(r);
    secretariasMap.set(sigla, atual);
  });

  const secretarias = [...secretariasMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Função auxiliar para dispor as competências de um setor sem sobreposição
  const adicionarCompetencias = (
    noPai: NoMapa,
    registrosDoSetor: Registro[],
  ) => {
    const total = registrosDoSetor.length;
    if (total === 0) return;

    // Disposição em coluna vertical espaçada para NUNCA haver sobreposição
    // Se o nó pai está à direita (x >= 0), competências ficam à direita (+260px)
    // Se o nó pai está à esquerda (x < 0), competências ficam à esquerda (-260px)
    const deslocamentoX = noPai.x >= 0 ? 260 : -260;
    const espacamentoY = 104; // Altura do cartão (88px) + margem confortável (16px)
    const inicioY = noPai.y - ((total - 1) * espacamentoY) / 2;

    registrosDoSetor.forEach((reg, pos) => {
      const posX = noPai.x + deslocamentoX;
      const posY = inicioY + pos * espacamentoY;

      const noComp: NoMapa = {
        id: `comp-${reg.id}`,
        tipo: 'competencia',
        rotulo: reg.competencia.slice(0, 65),
        subtitulo: reg.moduloSig || reg.informacoesAcessadas || '',
        paiId: noPai.id,
        x: posX,
        y: posY,
        largura: LARGURA_COMPETENCIA,
        altura: ALTURA_COMPETENCIA,
        registro: reg,
        cor: corPorSituacao[calcularSituacao(reg)],
      };
      nos.push(noComp);
      ligacoes.push({
        id: `lig-${noPai.id}-${noComp.id}`,
        origemId: noPai.id,
        destinoId: noComp.id,
      });
    });
  };

  // Quando filtrado para uma única Secretaria:
  if (secretarias.length === 1) {
    const [sigla, info] = secretarias[0];
    const pendentes = info.registros.filter((r) => calcularSituacao(r) !== 'aderido').length;

    const noRaizSec: NoMapa = {
      id: `sec-${sigla}`,
      tipo: 'raiz',
      rotulo: sigla,
      subtitulo: `${info.nome}${pendentes ? ` · ${pendentes} pend.` : ''}`,
      x: 0,
      y: 0,
      largura: LARGURA_RAIZ,
      altura: ALTURA_RAIZ,
      cor: '#60A5FA',
    };
    nos.push(noRaizSec);

    const siglasSetores = [
      ...new Set(info.registros.map((r) => r.setorSigla || r.setor)),
    ]
      .filter(Boolean)
      .sort();
    const raioSetores = Math.max(300, siglasSetores.length * 60);

    siglasSetores.forEach((setorSigla, idx) => {
      const doSetor = info.registros.filter((r) => (r.setorSigla || r.setor) === setorSigla);
      const pendentesSetor = doSetor.filter((r) => calcularSituacao(r) !== 'aderido').length;
      const angulo = (idx / Math.max(siglasSetores.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const cor = PALETA[idx % PALETA.length];

      const noSetor: NoMapa = {
        id: `setor-${setorSigla}`,
        tipo: 'setor',
        rotulo: setorSigla,
        subtitulo: `${doSetor.length} comp.${pendentesSetor ? ` · ${pendentesSetor} pend.` : ''}`,
        paiId: noRaizSec.id,
        x: Math.cos(angulo) * raioSetores,
        y: Math.sin(angulo) * raioSetores,
        largura: LARGURA_SETOR,
        altura: ALTURA_SETOR,
        cor,
      };
      nos.push(noSetor);
      ligacoes.push({
        id: `lig-${noRaizSec.id}-${noSetor.id}`,
        origemId: noRaizSec.id,
        destinoId: noSetor.id,
      });

      if (setoresExpandidos.has(setorSigla)) {
        adicionarCompetencias(noSetor, doSetor);
      }
    });

    return { nos, ligacoes };
  }

  // Visão Geral: "SÓ DAS SECRETARIAS"
  // Não há nó central "Prefeitura PVH" nem teia de aranha com dezenas de linhas.
  // Cada Secretaria é um nó independente e limpo disposto em círculo radial.
  const totalSec = secretarias.length;
  const raioSecretarias = Math.max(320, totalSec * 42);

  secretarias.forEach(([sigla, info], indice) => {
    const pendentes = info.registros.filter((r) => calcularSituacao(r) !== 'aderido').length;
    const angulo = (indice / totalSec) * Math.PI * 2 - Math.PI / 2;
    const cor = PALETA[indice % PALETA.length];

    const subtituloInfo = info.departamentoPrincipal
      ? `${info.registros.length} comp. (${info.departamentoPrincipal})${pendentes ? ` · ${pendentes} pend.` : ''}`
      : `${info.registros.length} comp.${pendentes ? ` · ${pendentes} pend.` : ''}`;

    const noSec: NoMapa = {
      id: `sec-${sigla}`,
      tipo: 'raiz',
      rotulo: sigla,
      subtitulo: subtituloInfo,
      x: Math.cos(angulo) * raioSecretarias,
      y: Math.sin(angulo) * raioSecretarias,
      largura: LARGURA_SETOR + 24,
      altura: ALTURA_SETOR + 12,
      cor,
    };
    nos.push(noSec);

    // Se o usuário clicar para expandir essa Secretaria:
    if (setoresExpandidos.has(sigla)) {
      const setoresDaSec = [
        ...new Set(info.registros.map((r) => r.setorSigla || r.setor)),
      ]
        .filter(Boolean)
        .sort();
      const raioFilhos = 220;
      const abertura = Math.PI * 0.7;

      setoresDaSec.forEach((setorSigla, p) => {
        const fracao = setoresDaSec.length === 1 ? 0.5 : p / (setoresDaSec.length - 1);
        const anguloItem = angulo - abertura / 2 + fracao * abertura;
        const doSubSetor = info.registros.filter((r) => (r.setorSigla || r.setor) === setorSigla);

        const noSub: NoMapa = {
          id: `setor-${setorSigla}`,
          tipo: 'setor',
          rotulo: setorSigla,
          subtitulo: `${doSubSetor.length} competências`,
          paiId: noSec.id,
          x: noSec.x + Math.cos(anguloItem) * raioFilhos,
          y: noSec.y + Math.sin(anguloItem) * raioFilhos,
          largura: LARGURA_SETOR,
          altura: ALTURA_SETOR,
          cor: PALETA[(indice + p + 1) % PALETA.length],
        };
        nos.push(noSub);
        ligacoes.push({
          id: `lig-${noSec.id}-${noSub.id}`,
          origemId: noSec.id,
          destinoId: noSub.id,
        });

        // Se o usuário clicar para expandir o setor daquela Secretaria:
        if (setoresExpandidos.has(setorSigla)) {
          adicionarCompetencias(noSub, doSubSetor);
        }
      });
    }
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

/**
 * Mapa mental exclusivo da aba Contatos Institucionais:
 *   Nível 1: Secretarias (anel limpo, sem sobreposição)
 *   Nível 2: Setor / Setores daquela Secretaria (ao clicar na Secretaria)
 *   Nível 3: Nome dos Contatos daquele Setor (ao clicar no Setor)
 *
 * Ao clicar duas vezes no nome do contato, abre o card de detalhes com
 * cópia rápida e redirecionamento direto para o Telefone (`tel:`).
 */
export const montarMapaDeContatos = (
  contatos: ContatoIntegrado[],
  expandidos: Set<string>,
): { nos: NoMapa[]; ligacoes: LigacaoMapa[] } => {
  const nos: NoMapa[] = [];
  const ligacoes: LigacaoMapa[] = [];

  if (!contatos.length) return { nos, ligacoes };

  // Agrupa por Secretaria
  const porSecretaria = new Map<string, ContatoIntegrado[]>();
  contatos.forEach((c) => {
    const sec = (c.secretaria || 'GERAL').trim().toUpperCase();
    porSecretaria.set(sec, [...(porSecretaria.get(sec) ?? []), c]);
  });

  const secretarias = [...porSecretaria.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  const totalSec = secretarias.length;
  const raioSec = Math.max(300, totalSec * 44);

  secretarias.forEach(([siglaSec, listaSec], indice) => {
    const angulo = (indice / Math.max(totalSec, 1)) * Math.PI * 2 - Math.PI / 2;
    const cor = PALETA[indice % PALETA.length];

    // Agrupa os contatos desta secretaria por Setor
    const porSetor = new Map<string, ContatoIntegrado[]>();
    listaSec.forEach((c) => {
      const setorChave = (c.setorSigla || c.setor || 'Geral').trim();
      porSetor.set(setorChave, [...(porSetor.get(setorChave) ?? []), c]);
    });

    const setores = [...porSetor.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
    const semCanal = listaSec.filter((c) => c.semContato).length;

    const noSec: NoMapa = {
      id: `sec-contato-${siglaSec}`,
      tipo: 'raiz',
      rotulo: siglaSec,
      subtitulo: `${listaSec.length} contato${listaSec.length === 1 ? '' : 's'} · ${setores.length} setor${setores.length === 1 ? '' : 'es'}${semCanal ? ` · ${semCanal} pend.` : ''}`,
      x: totalSec === 1 ? 0 : Math.cos(angulo) * raioSec,
      y: totalSec === 1 ? 0 : Math.sin(angulo) * raioSec,
      largura: LARGURA_SETOR + 24,
      altura: ALTURA_SETOR + 12,
      cor,
    };
    nos.push(noSec);

    if (expandidos.has(siglaSec)) {
      const raioSetores = 225;
      const abertura = Math.PI * 0.72;

      setores.forEach(([rotuloSetor, contatosDoSetor], p) => {
        const fracao = setores.length === 1 ? 0.5 : p / (setores.length - 1);
        const anguloSetor = angulo - abertura / 2 + fracao * abertura;

        const noSetor: NoMapa = {
          id: `setor-contato-${siglaSec}-${rotuloSetor}`,
          tipo: 'setor',
          rotulo: rotuloSetor,
          subtitulo: `${contatosDoSetor.length} contato${contatosDoSetor.length === 1 ? '' : 's'}`,
          paiId: noSec.id,
          x: noSec.x + Math.cos(anguloSetor) * raioSetores,
          y: noSec.y + Math.sin(anguloSetor) * raioSetores,
          largura: LARGURA_SETOR,
          altura: ALTURA_SETOR,
          cor: PALETA[(indice + p + 1) % PALETA.length],
        };
        nos.push(noSetor);
        ligacoes.push({
          id: `lig-${noSec.id}-${noSetor.id}`,
          origemId: noSec.id,
          destinoId: noSetor.id,
        });

        if (expandidos.has(rotuloSetor)) {
          const deslocamentoX = noSetor.x >= 0 ? 250 : -250;
          const espacamentoY = 98;
          const inicioY = noSetor.y - ((contatosDoSetor.length - 1) * espacamentoY) / 2;

          contatosDoSetor.forEach((contato, pos) => {
            const noContato: NoMapa = {
              id: `contato-${contato.id}`,
              tipo: 'contato',
              rotulo: contato.nome,
              subtitulo:
                [contato.cargo, contato.telefone || contato.email || 'Sem canal cadastrado']
                  .filter(Boolean)
                  .join(' · '),
              paiId: noSetor.id,
              x: noSetor.x + deslocamentoX,
              y: inicioY + pos * espacamentoY,
              largura: LARGURA_COMPETENCIA,
              altura: ALTURA_COMPETENCIA - 6,
              contato,
              cor: contato.semContato ? '#f59e0b' : '#2563eb',
            };
            nos.push(noContato);
            ligacoes.push({
              id: `lig-${noSetor.id}-${noContato.id}`,
              origemId: noSetor.id,
              destinoId: noContato.id,
            });
          });
        }
      });
    }
  });

  return { nos, ligacoes };
};
