import React from 'react';
import { TextInput, View } from 'react-native';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useTema } from '../tema/ThemeContext';
import { IconeLupa, IconeX } from '../tema/Icones';
import Tocavel from './Tocavel';
import { raios } from '../tema/raios';

type Props = {
  valor: string;
  aoAlterar: (texto: string) => void;
  aoPesquisar: () => void;
  /** O padrão fala do levantamento; um campo livre passa o texto dele. */
  placeholder?: string;
};

const BarraBusca: React.FC<Props> = ({ valor, aoAlterar, aoPesquisar, placeholder }) => {
  const tema = useTema();
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
        placeholder={placeholder ?? 'Buscar competência, setor, responsável...'}
        placeholderTextColor={tema.textoTerciario}
        style={estilos.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Buscar competências"
      />

      {valor.length > 0 ? (
        <Tocavel
          onPress={() => aoAlterar('')}
          hitSlop={8}
          style={estilos.botaoLimpar}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca">
          <IconeX tamanho={15} cor={tema.textoSecundario} />
        </Tocavel>
      ) : null}

      {/* Não há botão "Buscar": a lista já filtra sozinha enquanto se digita,
          e o botão cheio ao lado do campo disputava atenção com o conteúdo.
          Enter (ou a tecla de busca do teclado) continua chamando
          `aoPesquisar` para quem quer forçar a busca na hora. */}
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
    borderRadius: raios.g,
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
    marginRight: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.superficieAtiva,
  },
}));

export default BarraBusca;
