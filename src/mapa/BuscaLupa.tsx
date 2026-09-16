import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import { IconeLupa, IconeX } from '../tema/Icones';

type Props = {
  valor: string;
  aoAlterar: (texto: string) => void;
  /** Teto da largura aberta — o mapa passa o que sobra da barra superior. */
  larguraMaxima: number;
  placeholder?: string;
  /** Avisa quem desenha a barra: enquanto aberta, ela precisa da linha inteira. */
  aoMudarAbertura?: (aberta: boolean) => void;
};

const LARGURA_FECHADA = 40;
const DURACAO = 180;

/**
 * Busca minimalista: em repouso é só a lupa, um círculo do tamanho de um alvo
 * de toque. Ao tocar, ela se abre para a esquerda e vira campo de texto; o X
 * limpa e fecha.
 *
 * Fica no canto superior direito do mapa, onde não cobre os nós e não disputa
 * espaço com os botões de enquadramento (eles se escondem enquanto ela está
 * aberta, ver MapaMental).
 */
const BuscaLupa: React.FC<Props> = ({
  valor,
  aoAlterar,
  larguraMaxima,
  placeholder,
  aoMudarAbertura,
}) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  // O tipo da instância do TextInput não é o do componente (RN 0.87 exporta a
  // instância separada) — daí o ComponentRef em vez de useRef<TextInput>.
  const entrada = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [aberta, setAberta] = useState(false);

  const larguraAberta = Math.max(LARGURA_FECHADA, Math.min(260, larguraMaxima));
  const largura = useSharedValue(LARGURA_FECHADA);

  const estiloContainer = useAnimatedStyle(() => ({ width: largura.value }));

  const abrir = () => {
    setAberta(true);
    aoMudarAbertura?.(true);
    largura.value = withTiming(larguraAberta, { duration: DURACAO });
    // O foco espera a animação: focar antes faz o teclado subir com o campo
    // ainda do tamanho do botão, e o cursor "pula" quando ele termina de abrir.
    setTimeout(() => entrada.current?.focus(), DURACAO);
  };

  const fechar = () => {
    aoAlterar('');
    setAberta(false);
    aoMudarAbertura?.(false);
    entrada.current?.blur();
    largura.value = withTiming(LARGURA_FECHADA, { duration: DURACAO });
  };

  return (
    <Animated.View style={[estilos.container, estiloContainer]}>
      {aberta ? (
        <>
          <View style={estilos.lupaInterna} pointerEvents="none">
            <IconeLupa tamanho={15} cor={tema.textoTerciario} />
          </View>

          <TextInput
            ref={entrada}
            value={valor}
            onChangeText={aoAlterar}
            placeholder={placeholder ?? 'Buscar no mapa...'}
            placeholderTextColor={tema.textoTerciario}
            style={estilos.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar no mapa"
            onSubmitEditing={() => entrada.current?.blur()}
          />

          <Pressable
            onPress={fechar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fechar busca"
            style={estilos.botaoFechar}>
            <IconeX tamanho={13} cor={tema.textoSecundario} />
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel="Buscar no mapa"
          style={estilos.botaoLupa}>
          <IconeLupa tamanho={17} cor={tema.primariaTexto} />
        </Pressable>
      )}
    </Animated.View>
  );
};

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    container: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: tema.borda,
      backgroundColor: tema.fundoElevado,
      overflow: 'hidden',
    },
    botaoLupa: {
      width: LARGURA_FECHADA - 2,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lupaInterna: { paddingLeft: 12 },
    input: {
      flex: 1,
      minWidth: 0,
      height: 38,
      paddingHorizontal: 8,
      color: tema.texto,
      fontSize: 13,
    },
    botaoFechar: {
      width: 28,
      height: 28,
      marginRight: 6,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tema.superficieAtiva,
    },
  });

export default BuscaLupa;
