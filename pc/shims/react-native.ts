/**
 * Ponte entre o código do app (que importa de 'react-native') e o navegador.
 *
 * O react-native-web cobre quase tudo que o NotaDASI usa — View, Text,
 * Pressable, ScrollView, FlatList, Modal, TextInput, StyleSheet, etc. —
 * mas NÃO implementa três coisas que o app chama. Em vez de espalhar
 * `Platform.OS === 'web'` por 6 arquivos do app, reimplementamos as três
 * aqui e o Vite aponta 'react-native' para este módulo (ver vite.config.ts).
 *
 * Os exports locais abaixo têm precedência sobre o `export *` (regra de
 * ESM), então se uma versão futura do react-native-web passar a exportar
 * Alert, este arquivo continua mandando — e é aqui que se remove o shim.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
export * from 'react-native-web';

type PropsModalWeb = {
  visible?: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  onDismiss?: () => void;
  onShow?: () => void;
  children?: React.ReactNode;
};

/**
 * Modal compatível com React 19 + StrictMode.
 *
 * O `ModalPortal` interno do react-native-web remove o <div> do document.body
 * no cleanup do useEffect([], []) disparado pelo StrictMode do React 19 sem
 * forçar novo render, fazendo o modal sumir até outro estado da tela mudar.
 * Usar `createPortal(..., document.body)` diretamente elimina esse bug por completo.
 */
export const Modal: React.FC<PropsModalWeb> = ({
  visible = true,
  transparent = false,
  onRequestClose,
  onShow,
  children,
}) => {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    onShow?.();
  }, [visible, onShow]);

  useEffect(() => {
    if (!visible || !onRequestClose || typeof document === 'undefined') return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onRequestClose();
      }
    };
    document.addEventListener('keydown', aoTecla);
    return () => document.removeEventListener('keydown', aoTecla);
  }, [visible, onRequestClose]);

  if (!visible || !montado || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    React.createElement(
      'div',
      {
        role: 'dialog',
        'aria-modal': true,
        style: {
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: transparent ? 'transparent' : '#ffffff',
        },
      },
      children,
    ),
    document.body,
  );
};

type BotaoAlerta = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Alert do RN sobre os diálogos do navegador.
 *
 * Sem botões (ou com um só) vira `window.alert`. Com dois vira
 * `window.confirm`, onde OK dispara o primeiro botão que NÃO é 'cancel' —
 * é assim que as chamadas do app estão escritas (Cancelar + ação).
 */
export const Alert = {
  alert: (titulo: string, mensagem?: string, botoes?: BotaoAlerta[]): void => {
    const texto = mensagem ? `${titulo}\n\n${mensagem}` : titulo;

    if (!botoes || botoes.length === 0) {
      window.alert(texto);
      return;
    }

    const confirmar = botoes.find((botao) => botao.style !== 'cancel');
    const cancelar = botoes.find((botao) => botao.style === 'cancel');

    if (botoes.length === 1) {
      window.alert(texto);
      botoes[0].onPress?.();
      return;
    }

    if (window.confirm(texto)) {
      confirmar?.onPress?.();
    } else {
      cancelar?.onPress?.();
    }
  },
};

/**
 * Clipboard do RN sobre a API do navegador.
 *
 * `navigator.clipboard` exige contexto seguro (https ou localhost) — como o
 * alvo aqui é localhost, funciona. A falha é silenciosa de propósito: copiar
 * um telefone não pode derrubar a tela (mesmo critério do app nativo).
 */
export const Clipboard = {
  setString: (texto: string): void => {
    navigator.clipboard?.writeText(texto).catch(() => {
      // Navegador negou o acesso à área de transferência — segue sem copiar.
    });
  },
};

/**
 * No Android isto é a ponte JNI da busca rápida em C++ (cpp/nota_busca_rapida.cpp).
 * No navegador não existe módulo nativo nenhum: devolvemos um objeto vazio para
 * que src/native/NotaBuscaRapida.ts caia no fallback em JS puro que ele já tem.
 */
export const NativeModules: Record<string, unknown> = {};
