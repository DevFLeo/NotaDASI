import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { carregarRegistros as carregarRegistrosBase, obterOrigemDados } from './fonte';
import { normalizarNumeroSei, rotuloDecisaoParecer } from './kanban';
import type {
  ColunaKanban,
  ComentarioRegistro,
  DecisaoParecerUrgencia,
  EntradaAuditoria,
  NovoRegistro,
  ParecerUrgencia,
  Registro,
} from './registros';

const CHAVE_CRIADOS = '@notadasi:registros-criados';
const CHAVE_EDICOES = '@notadasi:registros-edicoes';
const CHAVE_EXCLUIDOS = '@notadasi:registros-excluidos';
const CHAVE_FAVORITOS = '@notadasi:registros-favoritos';
const CHAVE_ACEITE_EXCEL = '@notadasi:aceite-excel';
const CHAVE_BASE_CUSTOMIZADA = '@notadasi:base-customizada';
const CHAVE_NOME_PLANILHA = '@notadasi:nome-planilha';

export type AceiteExcelInfo = {
  aceito: boolean;
  dataHora: string;
  usuario: string;
  nome: string;
  papel: string;
  justificativa: string;
  totalRegistros: number;
  totalQuebras: number;
  quebrasToleradas: string[];
  nomeArquivo?: string;
};

type MapaEdicoes = Record<string, Registro>;

const lerJson = async <T,>(chave: string, valorPadrao: T): Promise<T> => {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    if (!bruto) {
      return valorPadrao;
    }
    const dados = JSON.parse(bruto);
    return dados ?? valorPadrao;
  } catch {
    return valorPadrao;
  }
};

const gravarJson = (chave: string, valor: unknown): void => {
  AsyncStorage.setItem(chave, JSON.stringify(valor)).catch(() => {
    // Falha ao salvar nao pode derrubar o app — a sessao atual segue normal.
  });
};

export const gerarIdRegistro = (): string =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Fonte unica de leitura E escrita dos registros na sessao do app.
 *
 * Os dados importados (planilha ou exemplo) sao tratados como somente
 * leitura — nunca sao reescritos em disco. Tudo que o usuario cria, edita,
 * exclui ou favorita fica em camadas separadas no AsyncStorage e e
 * recombinado aqui a cada render:
 *
 *   registros visiveis = (base - excluidos + edicoes) + criados (- excluidos)
 *
 * Chame este hook UMA VEZ, no componente pai (App.tsx), e passe `registros`
 * e as acoes para baixo — assim Lista e Mapa sempre veem o mesmo estado.
 */
export function useRegistros() {
  const base = useMemo(() => carregarRegistrosBase(), []);
  const origemBase = useMemo(() => obterOrigemDados(), []);

  const [basePlanilha, setBasePlanilha] = useState<Registro[]>([]);
  const [nomePlanilhaAtiva, setNomePlanilhaAtiva] = useState<string>('');
  const [aceiteExcel, setAceiteExcel] = useState<AceiteExcelInfo | null>(null);

  const [criados, setCriados] = useState<Registro[]>([]);
  const [edicoes, setEdicoes] = useState<MapaEdicoes>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;

    Promise.all([
      lerJson<Registro[]>(CHAVE_CRIADOS, []),
      lerJson<MapaEdicoes>(CHAVE_EDICOES, {}),
      lerJson<string[]>(CHAVE_EXCLUIDOS, []),
      lerJson<string[]>(CHAVE_FAVORITOS, []),
      lerJson<AceiteExcelInfo | null>(CHAVE_ACEITE_EXCEL, null),
      lerJson<Registro[]>(CHAVE_BASE_CUSTOMIZADA, []),
      AsyncStorage.getItem(CHAVE_NOME_PLANILHA).catch(() => null),
    ]).then(
      ([
        criadosSalvos,
        edicoesSalvas,
        excluidosSalvos,
        favoritosSalvos,
        aceiteSalvo,
        baseCustomSalva,
        nomePlanilhaSalva,
      ]) => {
        if (!ativo) {
          return;
        }
        setCriados(criadosSalvos);
        setEdicoes(edicoesSalvas);
        setExcluidos(new Set(excluidosSalvos));
        setFavoritos(new Set(favoritosSalvos));
        if (aceiteSalvo && aceiteSalvo.aceito) {
          setAceiteExcel(aceiteSalvo);
        }
        if (Array.isArray(baseCustomSalva) && baseCustomSalva.length > 0) {
          setBasePlanilha(baseCustomSalva);
        }
        if (nomePlanilhaSalva) {
          setNomePlanilhaAtiva(nomePlanilhaSalva);
        }
        setCarregado(true);
      },
    );

    return () => {
      ativo = false;
    };
  }, []);

  const baseEfetiva = useMemo(
    () => (basePlanilha.length > 0 ? basePlanilha : base),
    [basePlanilha, base],
  );

  const origem: 'planilha' | 'exemplo' = useMemo(() => {
    if (basePlanilha.length > 0) return 'planilha';
    return origemBase;
  }, [basePlanilha.length, origemBase]);

  const registros = useMemo(() => {
    const baseVisivel = baseEfetiva
      .filter((registro) => !excluidos.has(registro.id))
      .map((registro) => edicoes[registro.id] ?? registro);

    const criadosVisiveis = criados.filter((registro) => !excluidos.has(registro.id));

    return [...baseVisivel, ...criadosVisiveis].map((registro) => ({
      ...registro,
      favorito: favoritos.has(registro.id),
    }));
  }, [baseEfetiva, edicoes, excluidos, criados, favoritos]);

  const criarRegistro = useCallback((dados: NovoRegistro): Registro => {
    const registro: Registro = {
      ...dados,
      numeroSei: normalizarNumeroSei(dados.numeroSei),
      id: gerarIdRegistro(),
    };
    setCriados((atual) => {
      const proximo = [...atual, registro];
      gravarJson(CHAVE_CRIADOS, proximo);
      return proximo;
    });
    return registro;
  }, []);

  const atualizarRegistro = useCallback(
    (id: string, dados: NovoRegistro) => {
      const registro: Registro = {
        ...dados,
        numeroSei: normalizarNumeroSei(dados.numeroSei),
        id,
      };
      const éCriadoLocal = criados.some((item) => item.id === id);

      if (éCriadoLocal) {
        setCriados((atual) => {
          const proximo = atual.map((item) => (item.id === id ? registro : item));
          gravarJson(CHAVE_CRIADOS, proximo);
          return proximo;
        });
      } else {
        setEdicoes((atual) => {
          const proximo = { ...atual, [id]: registro };
          gravarJson(CHAVE_EDICOES, proximo);
          return proximo;
        });
      }
    },
    [criados],
  );

  const excluirRegistro = useCallback((id: string) => {
    setCriados((atual) => {
      const proximo = atual.filter((item) => item.id !== id);
      gravarJson(CHAVE_CRIADOS, proximo);
      return proximo;
    });

    setExcluidos((atual) => {
      if (atual.has(id)) {
        return atual;
      }
      const proximo = new Set(atual).add(id);
      gravarJson(CHAVE_EXCLUIDOS, Array.from(proximo));
      return proximo;
    });
  }, []);

  const alternarFavorito = useCallback((id: string) => {
    setFavoritos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      gravarJson(CHAVE_FAVORITOS, Array.from(proximo));
      return proximo;
    });
  }, []);

  const aplicarTransformacao = useCallback(
    (id: string, transformar: (registro: Registro) => Registro) => {
      const éCriadoLocal = criados.some((item) => item.id === id);
      if (éCriadoLocal) {
        setCriados((atual) => {
          const proximo = atual.map((item) => (item.id === id ? transformar(item) : item));
          gravarJson(CHAVE_CRIADOS, proximo);
          return proximo;
        });
      } else {
        setEdicoes((atual) => {
          const registroBase = atual[id] ?? baseEfetiva.find((r) => r.id === id);
          if (!registroBase) return atual;
          const proximo = { ...atual, [id]: transformar(registroBase) };
          gravarJson(CHAVE_EDICOES, proximo);
          return proximo;
        });
      }
    },
    [baseEfetiva, criados],
  );

  const adicionarComentario = useCallback(
    (
      id: string,
      comentario: {
        usuario: string;
        nome: string;
        papel: string;
        texto: string;
        numeroSei?: string;
        destinatario?: 'dasi' | 'gerente' | 'secretario' | 'todos';
      },
    ) => {
      const seiNormalizado = normalizarNumeroSei(comentario.numeroSei);
      const novoComentario: ComentarioRegistro = {
        ...comentario,
        numeroSei: seiNormalizado,
        id: `coment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataHora: new Date().toISOString(),
      };

      aplicarTransformacao(id, (registro) => ({
        ...registro,
        comentarios: [...(registro.comentarios ?? []), novoComentario],
      }));
    },
    [aplicarTransformacao],
  );

  const moverColunaKanban = useCallback(
    (
      id: string,
      coluna: ColunaKanban | undefined,
      opcoes?: { usuarioNome?: string; responsavelContinuidade?: string },
    ) => {
      const agora = new Date().toISOString();
      aplicarTransformacao(id, (registro) => {
        const responsavelLimpo = opcoes?.responsavelContinuidade?.trim();
        return {
          ...registro,
          kanban: {
            ...registro.kanban,
            colunaManual: coluna,
            responsavelContinuidade:
              opcoes?.responsavelContinuidade !== undefined
                ? responsavelLimpo || undefined
                : registro.kanban?.responsavelContinuidade,
            atualizadoEm: agora,
            atualizadoPor: opcoes?.usuarioNome || registro.kanban?.atualizadoPor,
          },
        };
      });
    },
    [aplicarTransformacao],
  );

  const registrarParecerUrgencia = useCallback(
    (
      id: string,
      dados: {
        usuario: string;
        nome: string;
        papel: string;
        decisao: DecisaoParecerUrgencia;
        parecer: string;
        responsavelContinuidade?: string;
        numeroSei?: string;
      },
    ) => {
      const agora = new Date().toISOString();
      const seiNormalizado = normalizarNumeroSei(dados.numeroSei);
      const responsavelLimpo = dados.responsavelContinuidade?.trim() || undefined;
      const textoParecer = dados.parecer.trim();
      if (!textoParecer) return;

      const novoParecer: ParecerUrgencia = {
        id: `parecer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataHora: agora,
        usuario: dados.usuario,
        nome: dados.nome,
        papel: dados.papel,
        decisao: dados.decisao,
        parecer: textoParecer,
        responsavelContinuidade: responsavelLimpo,
        numeroSei: seiNormalizado,
      };

      const resumoDecisao = `Parecer de Urgência (${rotuloDecisaoParecer[dados.decisao]})${
        responsavelLimpo ? ` · Continuidade: ${responsavelLimpo}` : ''
      }: ${textoParecer}`;

      const comentarioVinculado: ComentarioRegistro = {
        id: `coment-parecer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataHora: agora,
        usuario: dados.usuario,
        nome: dados.nome,
        papel: dados.papel,
        texto: resumoDecisao,
        numeroSei: seiNormalizado,
      };

      aplicarTransformacao(id, (registro) => ({
        ...registro,
        numeroSei: registro.numeroSei || seiNormalizado,
        kanban: {
          ...registro.kanban,
          colunaManual: dados.decisao,
          responsavelContinuidade:
            dados.responsavelContinuidade !== undefined
              ? responsavelLimpo
              : registro.kanban?.responsavelContinuidade,
          atualizadoEm: agora,
          atualizadoPor: dados.nome || dados.usuario,
          pareceresUrgencia: [...(registro.kanban?.pareceresUrgencia ?? []), novoParecer],
        },
        comentarios: [...(registro.comentarios ?? []), comentarioVinculado],
      }));
    },
    [aplicarTransformacao],
  );

  const salvarNotaPessoal = useCallback(
    (id: string, usuario: string, texto: string) => {
      aplicarTransformacao(id, (registro) => ({
        ...registro,
        notasPessoais: { ...(registro.notasPessoais ?? {}), [usuario]: texto },
      }));
    },
    [aplicarTransformacao],
  );

  /** Apaga tudo que foi criado/editado/excluído/favoritado localmente. A base importada não é afetada. */
  const limparDadosLocais = useCallback(() => {
    setCriados([]);
    setEdicoes({});
    setExcluidos(new Set());
    setFavoritos(new Set());
    gravarJson(CHAVE_CRIADOS, []);
    gravarJson(CHAVE_EDICOES, {});
    gravarJson(CHAVE_EXCLUIDOS, []);
    gravarJson(CHAVE_FAVORITOS, []);
  }, []);

  const salvarAceiteExcel = useCallback(
    (dados: {
      usuario: string;
      nome: string;
      papel: string;
      justificativa: string;
      totalRegistros: number;
      totalQuebras: number;
      quebrasToleradas: string[];
      nomeArquivo?: string;
    }) => {
      const info: AceiteExcelInfo = {
        aceito: true,
        dataHora: new Date().toISOString(),
        usuario: dados.usuario,
        nome: dados.nome,
        papel: dados.papel,
        justificativa: dados.justificativa,
        totalRegistros: dados.totalRegistros,
        totalQuebras: dados.totalQuebras,
        quebrasToleradas: dados.quebrasToleradas,
        nomeArquivo: dados.nomeArquivo || nomePlanilhaAtiva || 'DIAGNOSTICO_DE_ADESAO_AO_SISTEMA_GEO_360_(2).xlsx',
      };
      setAceiteExcel(info);
      gravarJson(CHAVE_ACEITE_EXCEL, info);

      // Registra entrada de auditoria nas edições dos registros
      const entradaAuditoria: EntradaAuditoria = {
        id: `audit-aceite-${Date.now()}`,
        dataHora: info.dataHora,
        usuario: dados.usuario,
        nome: dados.nome,
        papel: dados.papel,
        acao: 'ACEITE_EXCEL',
        detalhes: `Aceite da planilha homologado nas configurações pelo DASI (${dados.totalQuebras} quebras regimentais toleradas). Despacho: ${dados.justificativa}`,
      };

      setEdicoes((atual) => {
        const proximo = { ...atual };
        const idAlvo = (basePlanilha[0] || base[0])?.id;
        if (idAlvo) {
          const reg = proximo[idAlvo] ?? (basePlanilha.find((r) => r.id === idAlvo) || base.find((r) => r.id === idAlvo));
          if (reg) {
            proximo[idAlvo] = {
              ...reg,
              historicoAuditoria: [...(reg.historicoAuditoria ?? []), entradaAuditoria],
            };
          }
        }
        gravarJson(CHAVE_EDICOES, proximo);
        return proximo;
      });
    },
    [basePlanilha, base, nomePlanilhaAtiva],
  );

  const reverterAceiteExcel = useCallback(() => {
    setAceiteExcel(null);
    AsyncStorage.removeItem(CHAVE_ACEITE_EXCEL).catch(() => {});
  }, []);

  const carregarBasePlanilha = useCallback((novos: Registro[], nomeArquivo: string = 'planilha_importada.xlsx') => {
    setBasePlanilha(novos);
    setNomePlanilhaAtiva(nomeArquivo);
    gravarJson(CHAVE_BASE_CUSTOMIZADA, novos);
    AsyncStorage.setItem(CHAVE_NOME_PLANILHA, nomeArquivo).catch(() => {});
  }, []);

  const restaurarBasePadrao = useCallback(() => {
    setBasePlanilha([]);
    setNomePlanilhaAtiva('');
    setAceiteExcel(null);
    AsyncStorage.removeItem(CHAVE_BASE_CUSTOMIZADA).catch(() => {});
    AsyncStorage.removeItem(CHAVE_NOME_PLANILHA).catch(() => {});
    AsyncStorage.removeItem(CHAVE_ACEITE_EXCEL).catch(() => {});
  }, []);

  return {
    registros,
    origem,
    carregado,
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
  };
}
