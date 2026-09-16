import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CAMPO_SIG,
  ID_CAMPO_SIG,
  gerarIdAnotacao,
  gerarIdCampo,
  type Anotacao,
  type Campo,
  type RequisitoCampo,
} from './campos';

const CHAVE_CAMPOS = '@notadasi:campos';
const CHAVE_CAMPO_ATIVO = '@notadasi:campo-ativo';
const CHAVE_ANOTACOES = '@notadasi:campos-anotacoes';

type MapaAnotacoes = Record<string, Anotacao[]>;

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
    // Falha ao salvar não pode derrubar o app — a sessão atual segue normal.
  });
};

/**
 * Estado dos campos (cofres) e dos itens de cada campo livre.
 *
 * O campo do SIG não é guardado em disco: ele existe sempre, e os registros
 * dele continuam vindo do `useRegistros` (planilha + camadas locais). Aqui
 * ficam só os campos criados pelo usuário e as anotações deles, separadas por
 * campo — é isso que faz um campo novo ser mesmo um cofre à parte, e não um
 * filtro sobre os mesmos dados.
 *
 * Chame UMA VEZ, no App, e passe para baixo: Lista e Mapa precisam enxergar o
 * mesmo campo ativo.
 */
export function useCampos() {
  const [criados, setCriados] = useState<Campo[]>([]);
  const [anotacoesPorCampo, setAnotacoesPorCampo] = useState<MapaAnotacoes>({});
  const [idAtivo, setIdAtivo] = useState<string>(ID_CAMPO_SIG);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;

    Promise.all([
      lerJson<Campo[]>(CHAVE_CAMPOS, []),
      lerJson<MapaAnotacoes>(CHAVE_ANOTACOES, {}),
      AsyncStorage.getItem(CHAVE_CAMPO_ATIVO),
    ]).then(([camposSalvos, anotacoesSalvas, ativoSalvo]) => {
      if (!ativo) {
        return;
      }
      setCriados(camposSalvos);
      setAnotacoesPorCampo(anotacoesSalvas);
      // Um campo excluído noutra sessão não pode deixar o app apontando para o
      // vazio: na dúvida, volta para o campo do SIG.
      const existe =
        ativoSalvo === ID_CAMPO_SIG || camposSalvos.some((campo) => campo.id === ativoSalvo);
      setIdAtivo(existe && ativoSalvo ? ativoSalvo : ID_CAMPO_SIG);
      setCarregado(true);
    });

    return () => {
      ativo = false;
    };
  }, []);

  const campos = useMemo<Campo[]>(() => [CAMPO_SIG, ...criados], [criados]);

  const campoAtivo = useMemo<Campo>(
    () => campos.find((campo) => campo.id === idAtivo) ?? CAMPO_SIG,
    [campos, idAtivo],
  );

  const anotacoes = useMemo<Anotacao[]>(
    () => anotacoesPorCampo[campoAtivo.id] ?? [],
    [anotacoesPorCampo, campoAtivo.id],
  );

  const definirCampoAtivo = useCallback((id: string) => {
    setIdAtivo(id);
    AsyncStorage.setItem(CHAVE_CAMPO_ATIVO, id).catch(() => {});
  }, []);

  const criarCampo = useCallback(
    (nome: string, formulario: RequisitoCampo[]): Campo => {
      const campo: Campo = {
        id: gerarIdCampo(),
        nome: nome.trim() || 'Novo campo',
        tipo: 'livre',
        formulario,
        criadoEm: new Date().toISOString(),
      };

      setCriados((atual) => {
        const proximo = [...atual, campo];
        gravarJson(CHAVE_CAMPOS, proximo);
        return proximo;
      });

      // Criar um campo é entrar nele: é o que o usuário espera depois de
      // descrever o formulário.
      definirCampoAtivo(campo.id);
      return campo;
    },
    [definirCampoAtivo],
  );

  const atualizarCampo = useCallback((id: string, nome: string, formulario: RequisitoCampo[]) => {
    setCriados((atual) => {
      const proximo = atual.map((campo) =>
        campo.id === id ? { ...campo, nome: nome.trim() || campo.nome, formulario } : campo,
      );
      gravarJson(CHAVE_CAMPOS, proximo);
      return proximo;
    });
  }, []);

  /** Apaga o campo E tudo que havia dentro dele. O campo do SIG é intocável. */
  const excluirCampo = useCallback(
    (id: string) => {
      if (id === ID_CAMPO_SIG) {
        return;
      }

      setCriados((atual) => {
        const proximo = atual.filter((campo) => campo.id !== id);
        gravarJson(CHAVE_CAMPOS, proximo);
        return proximo;
      });

      setAnotacoesPorCampo((atual) => {
        const proximo = { ...atual };
        delete proximo[id];
        gravarJson(CHAVE_ANOTACOES, proximo);
        return proximo;
      });

      setIdAtivo((atual) => {
        if (atual !== id) {
          return atual;
        }
        AsyncStorage.setItem(CHAVE_CAMPO_ATIVO, ID_CAMPO_SIG).catch(() => {});
        return ID_CAMPO_SIG;
      });
    },
    [],
  );

  const alterarAnotacoes = useCallback(
    (campoId: string, transformar: (atual: Anotacao[]) => Anotacao[]) => {
      setAnotacoesPorCampo((atual) => {
        const proximo = { ...atual, [campoId]: transformar(atual[campoId] ?? []) };
        gravarJson(CHAVE_ANOTACOES, proximo);
        return proximo;
      });
    },
    [],
  );

  const criarAnotacao = useCallback(
    (campoId: string, valores: Anotacao['valores']) => {
      const agora = new Date().toISOString();
      const anotacao: Anotacao = {
        id: gerarIdAnotacao(),
        campoId,
        valores,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      alterarAnotacoes(campoId, (atual) => [...atual, anotacao]);
      return anotacao;
    },
    [alterarAnotacoes],
  );

  const atualizarAnotacao = useCallback(
    (campoId: string, id: string, valores: Anotacao['valores']) => {
      alterarAnotacoes(campoId, (atual) =>
        atual.map((item) =>
          item.id === id ? { ...item, valores, atualizadoEm: new Date().toISOString() } : item,
        ),
      );
    },
    [alterarAnotacoes],
  );

  const excluirAnotacao = useCallback(
    (campoId: string, id: string) => {
      alterarAnotacoes(campoId, (atual) => atual.filter((item) => item.id !== id));
    },
    [alterarAnotacoes],
  );

  const totalDeItens = useCallback(
    (campo: Campo, totalRegistrosSig: number) =>
      campo.tipo === 'sig' ? totalRegistrosSig : (anotacoesPorCampo[campo.id] ?? []).length,
    [anotacoesPorCampo],
  );

  return {
    campos,
    campoAtivo,
    anotacoes,
    carregado,
    definirCampoAtivo,
    criarCampo,
    atualizarCampo,
    excluirCampo,
    criarAnotacao,
    atualizarAnotacao,
    excluirAnotacao,
    totalDeItens,
  };
}
