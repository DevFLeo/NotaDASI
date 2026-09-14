import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useMetricas, useTema } from '../tema/ThemeContext';
import { IconeLupa, IconeX } from '../tema/Icones';

type Props = {
  valor: string;
  aoAlterar: (texto: string) => void;
  aoPesquisar: () => void;
};

const BarraBusca: React.FC<Props> = ({ valor, aoAlterar, aoPesquisar }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosBusca);

  return (
    <View style={estilos.container}>
      <View style={estilos.lupa} pointerEvents="none">
        <IconeLupa tamanho={17} cor={tema.textoTerciario} />
      </View>

      <TextInput
        value={valor}
        onChangeText={aoAlterar}
        onSubmitEditing={aoPesquisar}
        placeholder="Buscar competência, setor, responsável..."
        placeholderTextColor={tema.textoTerciario}
        style={estilos.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Buscar competências"
      />

      {valor.length > 0 ? (
        <Pressable
          onPress={() => aoAlterar('')}
          hitSlop={8}
          style={estilos.botaoLimpar}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca">
          <IconeX tamanho={15} cor={tema.textoSecundario} />
        </Pressable>
      ) : null}

      {/* Em tela estreita o rótulo "Buscar" rouba metade da barra do campo de
          texto — ali o botão vira só o ícone (a busca também roda sozinha
          enquanto se digita, então ele é um atalho, não o único caminho). */}
      <Pressable
        onPress={aoPesquisar}
        style={estilos.botaoBusca}
        accessibilityRole="button"
        accessibilityLabel="Buscar">
        {metricas.compacta ? (
          <IconeLupa tamanho={17} cor={tema.textoInvertido} />
        ) : (
          <Text style={estilos.textoBotao} maxFontSizeMultiplier={metricas.fonteMaxDensa}>
            Buscar
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const criarEstilosBusca = criarEstilos((tema, m) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tema.superficie,
    borderColor: tema.borda,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  lupa: { paddingLeft: 14 },
  input: {
    flex: 1,
    minWidth: 0,
    height: m.compacta ? 46 : 52,
    color: tema.texto,
    fontSize: 15,
    paddingHorizontal: 10,
  },
  botaoLimpar: {
    width: 32,
    height: 32,
    marginRight: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.superficieAtiva,
  },
  botaoBusca: {
    backgroundColor: tema.primaria,
    alignSelf: 'stretch',
    minWidth: m.compacta ? 48 : 0,
    paddingHorizontal: m.compacta ? 0 : 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoBotao: {
    color: tema.textoInvertido,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
}));

export default BarraBusca;
