import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  acharConta,
  hashSenha,
  normalizarUsuario,
  reconciliarContas,
  senhaConfere,
  type Conta,
} from './contas';

/**
 * Sessão do usuário — quem está usando o app agora.
 *
 * Fica no MESMO armazenamento do resto (AsyncStorage), pelas MESMAS chaves nos
 * dois alvos: no Android é o banco dentro do sandbox do APK, no navegador é o
 * IndexedDB daquele perfil. Por isso a sessão sobrevive a fechar o app /
 * recarregar a aba — é o "salvar em cache" pedido, e vale para os dois.
 *
 * O que ele NÃO faz: sincronizar entre aparelhos. Trocar a senha no PC não
 * muda a senha no celular, pelo mesmo motivo que uma competência criada no PC
 * não aparece no celular — não há servidor ainda (ver pc/README.md).
 */

const CHAVE_CONTAS = '@notadasi:contas';
const CHAVE_SESSAO = '@notadasi:sessao';

export type ResultadoEntrada = { ok: true } | { ok: false; erro: string };

type ContextoSessao = {
  /** Enquanto true, o app ainda não sabe se há sessão salva — não mostre nada. */
  carregando: boolean;
  contas: Conta[];
  contaAtual: Conta | null;
  entrar: (usuario: string, senha: string) => ResultadoEntrada;
  sair: () => void;
  trocarSenha: (senhaAtual: string, senhaNova: string) => ResultadoEntrada;
};

const SessaoContext = createContext<ContextoSessao | null>(null);

const gravarContas = (contas: Conta[]): void => {
  AsyncStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas)).catch(() => {
    // Falha ao gravar não pode derrubar o app: a sessão atual continua válida.
  });
};

export const SessaoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contas, setContas] = useState<Conta[]>(() => reconciliarContas([]));
  const [usuarioAtual, setUsuarioAtual] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    Promise.all([
      AsyncStorage.getItem(CHAVE_CONTAS),
      AsyncStorage.getItem(CHAVE_SESSAO),
    ])
      .then(([brutoContas, brutoSessao]) => {
        if (!ativo) {
          return;
        }

        let salvas: Conta[] = [];
        try {
          salvas = brutoContas ? (JSON.parse(brutoContas) as Conta[]) : [];
        } catch {
          // Armazenamento corrompido: as contas padrão bastam para entrar.
        }

        const reconciliadas = reconciliarContas(Array.isArray(salvas) ? salvas : []);
        setContas(reconciliadas);

        // Uma conta excluída (ou um armazenamento de outra versão) não pode
        // deixar o app "logado" em alguém que não existe mais.
        const sessao = brutoSessao ? normalizarUsuario(brutoSessao) : null;
        const existe = sessao && reconciliadas.some((conta) => conta.usuario === sessao);
        setUsuarioAtual(existe ? sessao : null);
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  const contaAtual = useMemo(
    () => (usuarioAtual ? (acharConta(contas, usuarioAtual) ?? null) : null),
    [contas, usuarioAtual],
  );

  const entrar = useCallback(
    (usuario: string, senha: string): ResultadoEntrada => {
      const conta = acharConta(contas, usuario);

      if (!conta) {
        return { ok: false, erro: 'Não existe conta com esse nome.' };
      }
      if (!senhaConfere(conta, senha)) {
        return { ok: false, erro: 'Senha incorreta.' };
      }

      setUsuarioAtual(conta.usuario);
      AsyncStorage.setItem(CHAVE_SESSAO, conta.usuario).catch(() => {});
      return { ok: true };
    },
    [contas],
  );

  const sair = useCallback(() => {
    setUsuarioAtual(null);
    AsyncStorage.removeItem(CHAVE_SESSAO).catch(() => {});
  }, []);

  const trocarSenha = useCallback(
    (senhaAtual: string, senhaNova: string): ResultadoEntrada => {
      if (!contaAtual) {
        return { ok: false, erro: 'Ninguém está conectado.' };
      }
      if (!senhaConfere(contaAtual, senhaAtual)) {
        return { ok: false, erro: 'A senha atual não confere.' };
      }
      if (senhaNova.trim().length < 3) {
        return { ok: false, erro: 'A nova senha precisa de pelo menos 3 caracteres.' };
      }

      const proximas = contas.map((conta) =>
        conta.usuario === contaAtual.usuario ? { ...conta, senhaHash: hashSenha(senhaNova) } : conta,
      );

      setContas(proximas);
      gravarContas(proximas);
      return { ok: true };
    },
    [contaAtual, contas],
  );

  const valor = useMemo(
    () => ({ carregando, contas, contaAtual, entrar, sair, trocarSenha }),
    [carregando, contas, contaAtual, entrar, sair, trocarSenha],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
};

export const useSessao = (): ContextoSessao => {
  const contexto = useContext(SessaoContext);
  if (!contexto) {
    throw new Error('useSessao precisa estar dentro de um <SessaoProvider>.');
  }
  return contexto;
};
