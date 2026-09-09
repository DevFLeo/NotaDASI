import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  valor: string;
  aoAlterar: (texto: string) => void;
  aoPesquisar: () => void;
};

const BarraBusca: React.FC<Props> = ({ valor, aoAlterar, aoPesquisar }) => {
  return (
    <View style={styles.container}>
      <TextInput
        value={valor}
        onChangeText={aoAlterar}
        placeholder="Buscar notas"
        placeholderTextColor="#94A3B8"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable onPress={aoPesquisar} style={styles.botaoBusca}>
        <Text style={styles.textoBotao}>Buscar</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#E2E8F0',
    fontSize: 15,
    paddingHorizontal: 16,
  },
  botaoBusca: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoBotao: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
});

export default BarraBusca;
