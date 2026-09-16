import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Linking,
  Pressable,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { pareceTelefone, paraDiscagem } from '../data/telefone';
import { criarEstilos } from '../tema/estilos';
import { useEstilos } from '../tema/ThemeContext';

type Props = {
  texto: string;
  /** Estilo do texto normal — o número herda dele e só acrescenta o destaque. */
  estiloTexto?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const TEMPO_AVISO = 1600;

/**
 * Um valor de item que pode ser um telefone.
 *
 * - Toque: copia para a área de transferência (e avisa por 1,6 s).
 * - Segurar: abre o discador com o número já preenchido.
 *
 * Quando o texto não é uma sequência de números do tamanho de um telefone,
 * volta a ser um `Text` comum — assim um campo "Número" com 25 não vira um
 * botão de ligação (ver data/telefone.ts).
 *
 * O `Clipboard` vem do core do React Native, que o marca como deprecado: a
 * substituição é `@react-native-clipboard/clipboard`, que não pôde ser
 * instalado aqui (a rede da máquina não alcança o registro do npm). Ao migrar,
 * só esta linha muda.
 */
const NumeroTocavel: React.FC<Props> = ({ texto, estiloTexto, numberOfLines }) => {
  const estilos = useEstilos(criarEstilosNumero);
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
      }
    },
    [],
  );

  if (!pareceTelefone(texto)) {
    return (
      <Text style={estiloTexto} numberOfLines={numberOfLines}>
        {texto}
      </Text>
    );
  }

  const copiar = () => {
    Clipboard.setString(texto.trim());
    setCopiado(true);
    if (temporizador.current) {
      clearTimeout(temporizador.current);
    }
    temporizador.current = setTimeout(() => setCopiado(false), TEMPO_AVISO);
  };

  const ligar = () => {
    const url = `tel:${paraDiscagem(texto)}`;
    // O discador abre com o número preenchido — quem confirma a chamada é o
    // usuário, no aparelho. Se não houver discador (tablet sem telefonia), o
    // openURL rejeita e o aviso explica em vez de falhar calado.
    Linking.openURL(url).catch(() => {
      Alert.alert('Não foi possível ligar', 'Este aparelho não tem um discador para abrir.');
    });
  };

  return (
    <Pressable
      onPress={copiar}
      onLongPress={ligar}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Telefone ${texto}`}
      accessibilityHint="Toque para copiar, segure para ligar"
      style={({ pressed }) => [estilos.area, pressed && estilos.areaPressionada]}>
      <Text style={[estiloTexto, estilos.numero]} numberOfLines={numberOfLines}>
        {texto}
      </Text>
      <Text style={estilos.dica}>{copiado ? 'copiado ✓' : 'toque copia · segure liga'}</Text>
    </Pressable>
  );
};

const criarEstilosNumero = criarEstilos((tema) => ({
  area: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  areaPressionada: {
    backgroundColor: tema.primariaFundo,
    borderColor: tema.primaria,
  },
  numero: {
    color: tema.primariaTexto,
    fontWeight: '700',
  },
  dica: {
    color: tema.textoTerciario,
    fontSize: 9,
    marginTop: 2,
  },
}));

export default NumeroTocavel;
