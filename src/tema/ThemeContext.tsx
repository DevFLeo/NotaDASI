import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { temaClaro, temaEscuro, type Tema } from './cores';
import {
  ESCALA_TEXTO_PADRAO,
  calcularMetricas,
  limitarEscalaTexto,
  useMetricasDaJanela,
  type Metricas,
} from './responsivo';

export type PreferenciaTema = 'claro' | 'escuro' | 'sistema';

const CHAVE_PREFERENCIA = '@notadasi:preferencia-tema';
const CHAVE_ESCALA_TEXTO = '@notadasi:escala-texto';

/** Base do app é o tema claro — só muda se o usuário escolher escuro/sistema. */
const PADRAO: PreferenciaTema = 'claro';

type ContextoTema = {
  tema: Tema;
  metricas: Metricas;
  preferencia: PreferenciaTema;
  definirPreferencia: (preferencia: PreferenciaTema) => void;
  escalaTexto: number;
  definirEscalaTexto: (escala: number) => void;
};

const ThemeContext = createContext<ContextoTema | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const esquemaSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(PADRAO);
  const [escalaTexto, setEscalaTexto] = useState(ESCALA_TEXTO_PADRAO);

  // Um único assinante das dimensões da janela para o app inteiro: as métricas
  // descem pelo contexto em vez de cada componente chamar useWindowDimensions.
  const metricas = useMetricasDaJanela(escalaTexto);

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(CHAVE_PREFERENCIA).then((valor) => {
      if (ativo && (valor === 'claro' || valor === 'escuro' || valor === 'sistema')) {
        setPreferencia(valor);
      }
    });
    AsyncStorage.getItem(CHAVE_ESCALA_TEXTO).then((valor) => {
      const numero = Number(valor);
      if (ativo && valor !== null && Number.isFinite(numero)) {
        setEscalaTexto(limitarEscalaTexto(numero));
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

  // A pinça chama isto a cada degrau do gesto; gravar é barato e assíncrono,
  // mas o estado só muda quando o degrau muda de verdade — senão a lista
  // re-renderizaria a cada frame do gesto.
  const definirEscalaTexto = useCallback((proxima: number) => {
    const limitada = limitarEscalaTexto(proxima);
    setEscalaTexto((atual) => {
      if (atual === limitada) {
        return atual;
      }
      AsyncStorage.setItem(CHAVE_ESCALA_TEXTO, String(limitada)).catch(() => {
        // Falha ao salvar a escala não pode derrubar o app.
      });
      return limitada;
    });
  }, []);

  const modoResolvido = preferencia === 'sistema' ? (esquemaSistema ?? 'claro') : preferencia;
  const tema = modoResolvido === 'escuro' ? temaEscuro : temaClaro;

  const valor = useMemo(
    () => ({ tema, metricas, preferencia, definirPreferencia, escalaTexto, definirEscalaTexto }),
    [tema, metricas, preferencia, definirPreferencia, escalaTexto, definirEscalaTexto],
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
};

/**
 * Recalcula as métricas para uma ÁREA menor que a janela, só para o que estiver
 * dentro.
 *
 * Existe por causa do painel de 35% do PC (pc/CascaPC.tsx). Sem isto, a lista
 * dentro do painel pergunta "qual a largura?" e recebe a da JANELA: num monitor
 * de 1920px ela se acha em tela grande e desenha três colunas dentro de 600px,
 * com cartões de ~190px. O mesmo vale para margens e rótulos curtos.
 *
 * Com `largura` 0 (antes do primeiro onLayout) o componente é transparente e
 * repassa as métricas da janela — assim nada pisca esperando a medição.
 *
 * No Android ninguém usa isto: lá a área É a janela.
 */
export const AreaDeLayout: React.FC<{
  largura: number;
  altura: number;
  children: React.ReactNode;
}> = ({ largura, altura, children }) => {
  const contexto = usarContexto();
  const { escalaTexto } = contexto;

  const valor = useMemo(() => {
    if (largura <= 0 || altura <= 0) {
      return contexto;
    }
    return { ...contexto, metricas: calcularMetricas(largura, altura, escalaTexto) };
  }, [contexto, largura, altura, escalaTexto]);

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

/** Escala de texto da lista: ajustada pela pinça ou pelos chips em Ajustes. */
export const useEscalaTexto = (): [number, (escala: number) => void] => {
  const { escalaTexto, definirEscalaTexto } = usarContexto();
  return [escalaTexto, definirEscalaTexto];
};
