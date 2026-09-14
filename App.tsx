import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StatusBar, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AjustesTela from './src/components/AjustesTela';
import ListaRegistros from './src/components/ListaRegistros';
import DetalheRegistro from './src/components/DetalheRegistro';
import FormularioRegistro from './src/components/FormularioRegistro';
import MapaMental from './src/mapa/MapaMental';
import { registroEmBranco, type NovoRegistro, type Registro } from './src/data/registros';
import { useRegistros } from './src/data/useRegistros';
import { criarEstilos } from './src/tema/estilos';
import { ThemeProvider, useEstilos, useMetricas, useTema } from './src/tema/ThemeContext';
import { IconeEngrenagem, IconeLista, IconeMapa } from './src/tema/Icones';

type Aba = 'lista' | 'mapa' | 'ajustes';

/** Ordem física das abas — define para onde um swipe para esquerda/direita navega. */
const ORDEM_ABAS: Aba[] = ['lista', 'mapa', 'ajustes'];

type EstadoFormulario =
  | { modo: 'criar'; sugestao?: Partial<Registro> }
  | { modo: 'editar'; registro: Registro }
  | null;

const AppConteudo: React.FC = () => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosApp);
  const insets = useSafeAreaInsets();

  const [aba, setAba] = useState<Aba>('lista');
  const [selecionado, setSelecionado] = useState<Registro | null>(null);
  const [formulario, setFormulario] = useState<EstadoFormulario>(null);

  const {
    registros,
    origem,
    criarRegistro,
    atualizarRegistro,
    excluirRegistro,
    alternarFavorito,
    limparDadosLocais,
  } = useRegistros();

  const abrirCriacao = useCallback((sugestao?: Partial<Registro>) => {
    setFormulario({ modo: 'criar', sugestao });
  }, []);

  const abrirEdicao = useCallback((registro: Registro) => {
    setSelecionado(null);
    setFormulario({ modo: 'editar', registro });
  }, []);

  const fecharFormulario = useCallback(() => setFormulario(null), []);

  const alternarFavoritoDoRegistro = useCallback(
    (registro: Registro) => alternarFavorito(registro.id),
    [alternarFavorito],
  );

  const salvarFormulario = useCallback(
    (dados: NovoRegistro) => {
      if (formulario?.modo === 'editar') {
        atualizarRegistro(formulario.registro.id, dados);
      } else {
        criarRegistro(dados);
      }
      setFormulario(null);
    },
    [formulario, atualizarRegistro, criarRegistro],
  );

  const pedirExclusao = useCallback(
    (registro: Registro) => {
      Alert.alert('Excluir competência', 'Essa ação não pode ser desfeita. Deseja continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            excluirRegistro(registro.id);
            setSelecionado(null);
            setFormulario(null);
          },
        },
      ]);
    },
    [excluirRegistro],
  );

  const valorInicialFormulario =
    formulario?.modo === 'editar' ? formulario.registro : registroEmBranco(formulario?.sugestao);

  const trocarAbaRelativa = useCallback((delta: number) => {
    setAba((atual) => {
      const indiceAtual = ORDEM_ABAS.indexOf(atual);
      const proximoIndice = Math.min(ORDEM_ABAS.length - 1, Math.max(0, indiceAtual + delta));
      return ORDEM_ABAS[proximoIndice];
    });
  }, []);

  // Distância mínima para um arrasto contar como troca de aba: proporcional à
  // janela, senão um swipe confortável no tablet vira um gesto exagerado no
  // celular estreito (e vice-versa).
  const limiarSwipe = Math.max(48, Math.min(120, metricas.largura * 0.16));

  // Arrastar para o lado troca de aba (Lista ↔ Mapa mental ↔ Ajustes). Desativado
  // na aba do mapa, que já usa arrasto horizontal para mover a câmera do mapa —
  // os dois gestos disputariam o mesmo movimento.
  const gestoTrocarAba = Gesture.Pan()
    .enabled(aba !== 'mapa')
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((evento) => {
      if (evento.translationX <= -limiarSwipe) {
        runOnJS(trocarAbaRelativa)(1);
      } else if (evento.translationX >= limiarSwipe) {
        runOnJS(trocarAbaRelativa)(-1);
      }
    });

  return (
    <SafeAreaView style={estilos.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={tema.modo === 'escuro' ? 'light-content' : 'dark-content'} />

      <GestureDetector gesture={gestoTrocarAba}>
        <View style={estilos.conteudo}>
          <Animated.View key={aba} entering={FadeIn.duration(160)} style={estilos.conteudo}>
            {aba === 'lista' ? (
              <ListaRegistros
                registros={registros}
                origem={origem}
                aoSelecionar={setSelecionado}
                aoAlternarFavorito={alternarFavoritoDoRegistro}
                aoCriar={abrirCriacao}
              />
            ) : aba === 'mapa' ? (
              <MapaMental registros={registros} aoSelecionar={setSelecionado} aoCriar={abrirCriacao} />
            ) : (
              <AjustesTela
                origem={origem}
                totalRegistros={registros.length}
                aoLimparDados={limparDadosLocais}
              />
            )}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* A barra fica fora das bordas seguras de baixo de propósito: o fundo
          dela precisa correr até o fim da tela, e só o padding interno respeita
          a barra de gestos do Android / o home indicator do iOS. */}
      <View style={[estilos.barraAbas, { paddingBottom: (estilos.barraAbas.paddingTop as number) + insets.bottom }]}>
        <View style={estilos.abasInterno}>
          <BotaoAba
            rotulo="Lista"
            Icone={IconeLista}
            ativo={aba === 'lista'}
            aoTocar={() => setAba('lista')}
          />
          <BotaoAba
            rotulo={metricas.compacta ? 'Mapa' : 'Mapa mental'}
            Icone={IconeMapa}
            ativo={aba === 'mapa'}
            aoTocar={() => setAba('mapa')}
          />
          <BotaoAba
            rotulo="Ajustes"
            Icone={IconeEngrenagem}
            ativo={aba === 'ajustes'}
            aoTocar={() => setAba('ajustes')}
          />
        </View>
      </View>

      <DetalheRegistro
        registro={selecionado}
        aoFechar={() => setSelecionado(null)}
        aoEditar={abrirEdicao}
        aoExcluir={pedirExclusao}
        aoAlternarFavorito={alternarFavoritoDoRegistro}
      />

      <FormularioRegistro
        visivel={formulario !== null}
        tituloModal={formulario?.modo === 'editar' ? 'Editar competência' : 'Nova competência'}
        valorInicial={valorInicialFormulario}
        aoSalvar={salvarFormulario}
        aoCancelar={fecharFormulario}
        aoExcluir={
          formulario?.modo === 'editar' ? () => pedirExclusao(formulario.registro) : undefined
        }
      />
    </SafeAreaView>
  );
};

const App: React.FC = () => (
  <GestureHandlerRootView style={estilosRaiz.raiz}>
    <SafeAreaProvider>
      <ThemeProvider>
        <AppConteudo />
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

type ComponenteIcone = React.FC<{ tamanho?: number; cor: string }>;

const BotaoAba: React.FC<{
  rotulo: string;
  Icone: ComponenteIcone;
  ativo: boolean;
  aoTocar: () => void;
}> = ({ rotulo, Icone, ativo, aoTocar }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosApp);
  const cor = ativo ? tema.primariaTexto : tema.textoSecundario;

  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={rotulo}
      style={[estilos.aba, ativo && estilos.abaAtiva]}>
      <Icone tamanho={metricas.compacta ? 18 : 20} cor={cor} />
      <Text
        style={[estilos.textoAba, ativo && estilos.textoAbaAtiva]}
        numberOfLines={1}
        maxFontSizeMultiplier={metricas.fonteMaxDensa}
        adjustsFontSizeToFit>
        {rotulo}
      </Text>
    </Pressable>
  );
};

const estilosRaiz = { raiz: { flex: 1 } } as const;

const criarEstilosApp = criarEstilos((tema, m) => ({
  container: {
    flex: 1,
    backgroundColor: tema.fundo,
  },
  conteudo: {
    flex: 1,
  },
  barraAbas: {
    paddingHorizontal: m.margem,
    paddingTop: m.compacta ? 8 : 10,
    paddingBottom: m.compacta ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
    backgroundColor: tema.fundo,
  },
  // Em tablet a barra não precisa esticar de ponta a ponta: os alvos ficariam
  // enormes e longe do polegar.
  abasInterno: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: m.larguraMaxConteudo,
    alignSelf: 'center',
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: m.compacta ? 2 : 4,
    // Mantém o alvo de toque em pelo menos 48dp mesmo no layout compacto.
    minHeight: 48,
    paddingVertical: m.compacta ? 8 : 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: tema.superficie,
  },
  abaAtiva: {
    backgroundColor: tema.primariaFundo,
  },
  textoAba: {
    color: tema.textoSecundario,
    fontSize: m.compacta ? 10 : 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: m.compacta ? 0.3 : 0.7,
    maxWidth: '100%',
  },
  textoAbaAtiva: {
    color: tema.primariaTexto,
  },
}));

export default App;
