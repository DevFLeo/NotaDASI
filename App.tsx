import React, { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ListaRegistros from './src/components/ListaRegistros';
import DetalheRegistro from './src/components/DetalheRegistro';
import MapaMental from './src/mapa/MapaMental';
import type { Registro } from './src/data/registros';

type Aba = 'lista' | 'mapa';

const App: React.FC = () => {
  const [aba, setAba] = useState<Aba>('lista');
  const [selecionado, setSelecionado] = useState<Registro | null>(null);

  return (
    <GestureHandlerRootView style={estilos.raiz}>
      <SafeAreaProvider>
        <SafeAreaView style={estilos.container} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="light-content" />

          <View style={estilos.conteudo}>
            {aba === 'lista' ? (
              <ListaRegistros aoSelecionar={setSelecionado} />
            ) : (
              <MapaMental aoSelecionar={setSelecionado} />
            )}
          </View>

          <View style={estilos.barraAbas}>
            <BotaoAba rotulo="Lista" ativo={aba === 'lista'} aoTocar={() => setAba('lista')} />
            <BotaoAba
              rotulo="Mapa mental"
              ativo={aba === 'mapa'}
              aoTocar={() => setAba('mapa')}
            />
          </View>

          <DetalheRegistro registro={selecionado} aoFechar={() => setSelecionado(null)} />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const BotaoAba: React.FC<{ rotulo: string; ativo: boolean; aoTocar: () => void }> = ({
  rotulo,
  ativo,
  aoTocar,
}) => (
  <Pressable
    onPress={aoTocar}
    accessibilityRole="tab"
    accessibilityState={{ selected: ativo }}
    style={[estilos.aba, ativo && estilos.abaAtiva]}>
    <Text style={[estilos.textoAba, ativo && estilos.textoAbaAtiva]}>{rotulo}</Text>
  </Pressable>
);

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  conteudo: {
    flex: 1,
  },
  barraAbas: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: '#07111f',
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
  },
  abaAtiva: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  textoAba: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  textoAbaAtiva: {
    color: '#dbeafe',
  },
});

export default App;
