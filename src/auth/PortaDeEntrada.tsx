import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import TelaLogin from './TelaLogin';
import { useSessao } from './useSessao';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useTema } from '../tema/ThemeContext';

/**
 * Decide o que aparece antes do app: nada, o login, ou o app.
 *
 * Fica entre os provedores e a casca da plataforma, então vale para os DOIS
 * alvos — o celular monta `<PortaDeEntrada><AppConteudo/></PortaDeEntrada>` e
 * o PC monta `<PortaDeEntrada><CascaPC/></PortaDeEntrada>`. Nenhum dos dois
 * repete a regra de "tem sessão?".
 *
 * O estado `carregando` existe porque ler o AsyncStorage é assíncrono: sem ele
 * o app piscaria a tela de login por um quadro a cada abertura, mesmo com
 * sessão salva.
 */
export const PortaDeEntrada: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { carregando, contaAtual } = useSessao();
  const tema = useTema();
  const estilos = useEstilos(criarEstilosPorta);

  if (carregando) {
    return (
      <View style={estilos.espera}>
        <ActivityIndicator color={tema.primaria} />
      </View>
    );
  }

  return contaAtual ? <>{children}</> : <TelaLogin />;
};

const criarEstilosPorta = criarEstilos((tema) => ({
  espera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.fundo,
  },
}));

export default PortaDeEntrada;
