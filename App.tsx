import React, { useCallback, useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AjustesTela from './src/components/AjustesTela';
import ListaAnotacoes from './src/components/ListaAnotacoes';
import ListaRegistros from './src/components/ListaRegistros';
import MapaMental from './src/mapa/MapaMental';
import PlanilhaTela from './src/components/PlanilhaTela';
import Modais from './src/app/Modais';
import { useAplicacao } from './src/app/useAplicacao';
import PortaDeEntrada from './src/auth/PortaDeEntrada';
import { SessaoProvider } from './src/auth/useSessao';
import { useSegurarParaAbrir } from './src/hooks/useSegurarParaAbrir';
import { criarEstilos } from './src/tema/estilos';
import { ThemeProvider, useEstilos, useMetricas, useTema } from './src/tema/ThemeContext';
import { IconeEngrenagem, IconeLista, IconeMapa, IconePlanilha } from './src/tema/Icones';

type Aba = 'lista' | 'mapa' | 'planilha' | 'ajustes';

/** Ordem física das abas — define para onde um swipe para esquerda/direita navega. */
const ORDEM_ABAS: Aba[] = ['lista', 'mapa', 'planilha', 'ajustes'];

/**
 * Casca do CELULAR: conteúdo em cima, barra de abas embaixo, uma tela por vez.
 *
 * É exportada porque o alvo PC também a usa — quando a janela do navegador é
 * estreita demais para a barra lateral, `pc/RaizPC.tsx` cai nesta mesma casca
 * em vez de espremer o layout de três colunas. Todo o estado vem de
 * `useAplicacao()`, compartilhado entre as duas cascas.
 */
export const AppConteudo: React.FC = () => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosApp);
  const insets = useSafeAreaInsets();
  const app = useAplicacao();

  const [aba, setAba] = useState<Aba>('lista');

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

  // Arrastar para o lado troca de aba (Lista ↔ Mapa mental ↔ Planilha ↔ Ajustes). Desativado
  // na aba do mapa, que já usa arrasto horizontal para mover a câmera do mapa —
  // os dois gestos disputariam o mesmo movimento.
  const gestoTrocarAba = Gesture.Pan()
    .enabled(aba !== 'mapa')
    // Um dedo só: com dois, o gesto é a pinça que ajusta o tamanho do texto na
    // lista — sem este limite, beliscar a tela também trocaria de aba.
    .maxPointers(1)
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
              app.eCampoLivre ? (
                <ListaAnotacoes
                  campo={app.campoAtivo}
                  anotacoes={app.anotacoes}
                  aoAbrir={app.abrirAnotacao}
                  aoCriar={app.criarNovaAnotacao}
                />
              ) : (
                <ListaRegistros
                  registros={app.registros}
                  origem={app.origem}
                  aoSelecionar={app.setSelecionado}
                  aoAlternarFavorito={app.alternarFavoritoDoRegistro}
                  aoCriar={app.abrirCriacao}
                />
              )
            ) : aba === 'mapa' ? (
              <MapaMental
                campo={app.campoAtivo}
                registros={app.registros}
                anotacoes={app.anotacoes}
                aoSelecionar={app.setSelecionado}
                aoCriar={app.abrirCriacao}
                aoAbrirAnotacao={app.abrirAnotacao}
                aoCriarAnotacao={app.criarNovaAnotacao}
              />
            ) : aba === 'planilha' ? (
              <PlanilhaTela />
            ) : (
              <AjustesTela
                origem={app.origem}
                totalRegistros={app.registros.length}
                aoLimparDados={app.limparDadosLocais}
                campoAtivo={app.campoAtivo}
                totalCampos={app.campos.length}
                aoAbrirCampos={app.abrirMenuCampos}
              />
            )}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* A barra fica fora das bordas seguras de baixo de propósito: o fundo
          dela precisa correr até o fim da tela, e só o padding interno respeita
          a barra de gestos do Android / o home indicator do iOS. */}
      <View
        style={[
          estilos.barraAbas,
          { paddingBottom: (estilos.barraAbas.paddingTop as number) + insets.bottom },
        ]}>
        <View style={estilos.abasInterno}>
          <BotaoAba
            rotulo="Lista"
            Icone={IconeLista}
            ativo={aba === 'lista'}
            aoTocar={() => setAba('lista')}
            aoSegurar={app.abrirMenuCampos}
          />
          <BotaoAba
            rotulo={metricas.compacta ? 'Mapa' : 'Mapa mental'}
            Icone={IconeMapa}
            ativo={aba === 'mapa'}
            aoTocar={() => setAba('mapa')}
            aoSegurar={app.abrirMenuCampos}
          />
          <BotaoAba
            rotulo="Planilha"
            Icone={IconePlanilha}
            ativo={aba === 'planilha'}
            aoTocar={() => setAba('planilha')}
          />
          <BotaoAba
            rotulo="Ajustes"
            Icone={IconeEngrenagem}
            ativo={aba === 'ajustes'}
            aoTocar={() => setAba('ajustes')}
          />
        </View>
      </View>

      <Modais app={app} />
    </SafeAreaView>
  );
};

/**
 * Os provedores que qualquer casca precisa, na ordem certa.
 *
 * Exportado para o alvo PC montar exatamente os mesmos (ver pc/main.tsx): se
 * cada plataforma listasse os seus, um provedor novo entraria só num lado e o
 * bug apareceria semanas depois, num alvo só.
 */
export const Provedores: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <GestureHandlerRootView style={estilosRaiz.raiz}>
    <SafeAreaProvider>
      <ThemeProvider>
        <SessaoProvider>{children}</SessaoProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

const App: React.FC = () => (
  <Provedores>
    <PortaDeEntrada>
      <AppConteudo />
    </PortaDeEntrada>
  </Provedores>
);

type ComponenteIcone = React.FC<{ tamanho?: number; cor: string }>;

const BotaoAba: React.FC<{
  rotulo: string;
  Icone: ComponenteIcone;
  ativo: boolean;
  aoTocar: () => void;
  /**
   * Segurar a aba abre o menu de campos (os cofres). É o caminho rápido: fica
   * sempre no mesmo lugar, some da HUD quando não é usado, e não muda nada do
   * que já está cadastrado — só troca de cofre ou cria outro.
   */
  aoSegurar?: () => void;
}> = ({ rotulo, Icone, ativo, aoTocar, aoSegurar }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosApp);
  const cor = ativo ? tema.primariaTexto : tema.textoSecundario;
  const segurar = useSegurarParaAbrir(aoSegurar);

  return (
    <Pressable
      onPress={aoTocar}
      {...segurar}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={rotulo}
      accessibilityHint={aoSegurar ? 'Segure para trocar de campo ou criar outro' : undefined}
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
