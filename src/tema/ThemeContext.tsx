import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { temaClaro, temaEscuro, type Tema } from './cores';
import { useMetricasDaJanela, type Metricas } from './responsivo';

export type PreferenciaTema = 'claro' | 'escuro' | 'sistema';

const CHAVE_PREFERENCIA = '@notadasi:preferencia-tema';

/** Base do app é o tema claro — só muda se o usuário escolher escuro/sistema. */
const PADRAO: PreferenciaTema = 'claro';

type ContextoTema = {
  tema: Tema;
  metricas: Metricas;
  preferencia: PreferenciaTema;
  definirPreferencia: (preferencia: PreferenciaTema) => void;
};

const ThemeContext = createContext<ContextoTema | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const esquemaSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(PADRAO);

  // Um único assinante das dimensões da janela para o app inteiro: as métricas
  // descem pelo contexto em vez de cada componente chamar useWindowDimensions.
  const metricas = useMetricasDaJanela();

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(CHAVE_PREFERENCIA).then((valor) => {
      if (ativo && (valor === 'claro' || valor === 'escuro' || valor === 'sistema')) {
        setPreferencia(valor);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  const definirPreferencia = useCallback((proxima: PreferenciaTema) => {
    setPreferencia(proxima);
    AsyncStorage.setItem(CHAVE_PREFERENCIA, proxima).catch(() => {
      // Falha ao salvar a preferência não pode derrubar o app.
    });
  }, []);

  const modoResolvido = preferencia === 'sistema' ? (esquemaSistema ?? 'claro') : preferencia;
  const tema = modoResolvido === 'escuro' ? temaEscuro : temaClaro;

  const valor = useMemo(
    () => ({ tema, metricas, preferencia, definirPreferencia }),
    [tema, metricas, preferencia, definirPreferencia],
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
};

const usarContexto = (): ContextoTema => {
  const contexto = useContext(ThemeContext);
  if (!contexto) {
    throw new Error('Os hooks de tema precisam estar dentro de um <ThemeProvider>.');
  }
  return contexto;
};

export const useTema = (): Tema => usarContexto().tema;

/** Métricas de layout da janela (classe de largura, colunas, margens...). */
export const useMetricas = (): Metricas => usarContexto().metricas;

/**
 * Resolve uma fábrica de `criarEstilos` com o tema e o layout atuais.
 * Devolve sempre a mesma referência enquanto tema e layout não mudarem.
 */
export const useEstilos = <T,>(fabrica: (tema: Tema, metricas: Metricas) => T): T => {
  const { tema, metricas } = usarContexto();
  return fabrica(tema, metricas);
};

export const usePreferenciaTema = (): [PreferenciaTema, (preferencia: PreferenciaTema) => void] => {
  const { preferencia, definirPreferencia } = usarContexto();
  return [preferencia, definirPreferencia];
};
