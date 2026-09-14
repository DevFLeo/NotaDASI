import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { carregarRegistros as carregarRegistrosBase, obterOrigemDados } from './fonte';
import type { NovoRegistro, Registro } from './registros';

const CHAVE_CRIADOS = '@notadasi:registros-criados';
const CHAVE_EDICOES = '@notadasi:registros-edicoes';
const CHAVE_EXCLUIDOS = '@notadasi:registros-excluidos';
const CHAVE_FAVORITOS = '@notadasi:registros-favoritos';

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
  const origem = useMemo(() => obterOrigemDados(), []);

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
    ]).then(([criadosSalvos, edicoesSalvas, excluidosSalvos, favoritosSalvos]) => {
      if (!ativo) {
        return;
      }
      setCriados(criadosSalvos);
      setEdicoes(edicoesSalvas);
      setExcluidos(new Set(excluidosSalvos));
      setFavoritos(new Set(favoritosSalvos));
      setCarregado(true);
    });

    return () => {
      ativo = false;
    };
  }, []);

  const registros = useMemo(() => {
    const baseVisivel = base
      .filter((registro) => !excluidos.has(registro.id))
      .map((registro) => edicoes[registro.id] ?? registro);

    const criadosVisiveis = criados.filter((registro) => !excluidos.has(registro.id));

    return [...baseVisivel, ...criadosVisiveis].map((registro) => ({
      ...registro,
      favorito: favoritos.has(registro.id),
    }));
  }, [base, edicoes, excluidos, criados, favoritos]);

  const criarRegistro = useCallback((dados: NovoRegistro): Registro => {
    const registro: Registro = { ...dados, id: gerarIdRegistro() };
    setCriados((atual) => {
      const proximo = [...atual, registro];
      gravarJson(CHAVE_CRIADOS, proximo);
      return proximo;
    });
    return registro;
  }, []);

  const atualizarRegistro = useCallback(
    (id: string, dados: NovoRegistro) => {
      const registro: Registro = { ...dados, id };
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

  return {
    registros,
    origem,
    carregado,
    criarRegistro,
    atualizarRegistro,
    excluirRegistro,
    alternarFavorito,
    limparDadosLocais,
  };
}
