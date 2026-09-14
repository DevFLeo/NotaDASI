import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Contato } from '../data/registros';
import { criarEstilos } from '../tema/estilos';
import { useEstilos } from '../tema/ThemeContext';

type Props = {
  contato?: Contato;
};

/**
 * Exibe o contato pessoal borrado ate o usuario tocar para revelar.
 *
 * O acesso e liberado apenas para a divisao DASI e a chefia de departamento,
 * mas o borrao evita exposicao acidental do dado em tela compartilhada.
 */
const ContatoProtegido: React.FC<Props> = ({ contato }) => {
  const estilos = useEstilos(criarEstilosContato);
  const [revelado, setRevelado] = useState(false);

  if (!contato || (!contato.email && !contato.telefone)) {
    return null;
  }

  const linhas = [contato.telefone, contato.email].filter(Boolean) as string[];

  return (
    <View style={estilos.container}>
      <Text style={estilos.rotulo}>Contato pessoal</Text>

      <Pressable
        onPress={() => setRevelado((atual) => !atual)}
        accessibilityRole="button"
        accessibilityLabel={
          revelado ? 'Ocultar contato pessoal' : 'Revelar contato pessoal (dado protegido)'
        }
        style={estilos.area}>
        {linhas.map((linha) => (
          <Text key={linha} style={[estilos.valor, !revelado && estilos.valorOculto]}>
            {revelado ? linha : mascarar(linha)}
          </Text>
        ))}

        <Text style={estilos.dica}>{revelado ? 'toque para ocultar' : '🔒 toque para revelar'}</Text>
      </Pressable>
    </View>
  );
};

/** Mantem o formato visual (tamanho e pontuacao) sem revelar os digitos. */
const mascarar = (texto: string): string =>
  texto.replace(/[a-zA-Z0-9]/g, '•');

const criarEstilosContato = criarEstilos((tema) => ({
    container: {
      marginTop: 14,
    },
    rotulo: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    area: {
      backgroundColor: tema.superficie,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tema.borda,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    valor: {
      color: tema.texto,
      fontSize: 13,
      lineHeight: 20,
    },
    valorOculto: {
      color: tema.textoSecundario,
      letterSpacing: 1.5,
    },
    dica: {
      color: tema.textoTerciario,
      fontSize: 10,
      marginTop: 6,
    },
}));

export default ContatoProtegido;
