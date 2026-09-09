import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { carregarRegistros } from '../data/fonte';
import type { Registro } from '../data/registros';
import { ligacoesPorCamada, montarMapa, type NoMapa } from './layout';
import { lerPosicoes, salvarPosicoes, type PosicoesSalvas } from './posicoes';

type Props = {
  aoSelecionar?: (registro: Registro) => void;
};

/**
 * Mapa mental interativo (estilo bloco de notas da Xiaomi):
 *
 * - Arrastar o fundo move o mapa inteiro (pan).
 * - Pinca com dois dedos aplica zoom.
 * - Cada no pode ser arrastado individualmente; a posicao fica salva.
 * - Tocar numa secretaria expande/recolhe os projetos dela.
 * - Linhas tracejadas ligam projetos de secretarias diferentes que tem o mesmo cargo.
 */
const MapaMental: React.FC<Props> = ({ aoSelecionar }) => {
  const registros = useMemo(() => carregarRegistros(), []);
  const { width: larguraTela, height: alturaTela } = useWindowDimensions();

  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const [posicoesSalvas, setPosicoesSalvas] = useState<PosicoesSalvas>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;

    lerPosicoes().then((posicoes) => {
      if (ativo) {
        setPosicoesSalvas(posicoes);
        setCarregado(true);
      }
    });

    return () => {
      ativo = false;
    };
  }, []);

  const { nos, ligacoes } = useMemo(() => montarMapa(registros, expandidos), [registros, expandidos]);

  const ligacoesExtras = useMemo(() => ligacoesPorCamada(nos), [nos]);

  // Posicao efetiva de cada no: a arrastada pelo usuario vence o layout automatico.
  const posicaoDe = useCallback(
    (no: NoMapa) => posicoesSalvas[no.id] ?? { x: no.x, y: no.y },
    [posicoesSalvas],
  );

  const registrarPosicao = useCallback((id: string, x: number, y: number) => {
    setPosicoesSalvas((atual) => {
      const proximo = { ...atual, [id]: { x, y } };
      salvarPosicoes(proximo);
      return proximo;
    });
  }, []);

  const alternarSetor = useCallback((sigla: string) => {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(sigla)) {
        proximo.delete(sigla);
      } else {
        proximo.add(sigla);
      }
      return proximo;
    });
  }, []);

  // ---- Camera (pan + zoom) -------------------------------------------------
  const deslocX = useSharedValue(larguraTela / 2);
  const deslocY = useSharedValue(alturaTela / 2);
  const escala = useSharedValue(0.75);

  const inicioX = useSharedValue(0);
  const inicioY = useSharedValue(0);
  const escalaInicial = useSharedValue(0.75);

  const gestoPan = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      inicioX.value = deslocX.value;
      inicioY.value = deslocY.value;
    })
    .onUpdate((evento) => {
      deslocX.value = inicioX.value + evento.translationX;
      deslocY.value = inicioY.value + evento.translationY;
    });

  const gestoPinca = Gesture.Pinch()
    .onBegin(() => {
      escalaInicial.value = escala.value;
    })
    .onUpdate((evento) => {
      const proxima = escalaInicial.value * evento.scale;
      escala.value = Math.min(2.5, Math.max(0.25, proxima));
    });

  const gestoCamera = Gesture.Simultaneous(gestoPan, gestoPinca);

  const estiloCamera = useAnimatedStyle(() => ({
    transform: [
      { translateX: deslocX.value },
      { translateY: deslocY.value },
      { scale: escala.value },
    ],
  }));

  if (!carregado) {
    return (
      <View style={estilos.carregando}>
        <Text style={estilos.textoCarregando}>Montando o mapa...</Text>
      </View>
    );
  }

  return (
    <View style={estilos.container}>
      <GestureDetector gesture={gestoCamera}>
        <View style={estilos.areaGesto} collapsable={false}>
          <Animated.View style={[estilos.camera, estiloCamera]}>
            <LinhasDoMapa
              nos={nos}
              ligacoes={ligacoes}
              ligacoesExtras={ligacoesExtras}
              posicaoDe={posicaoDe}
            />

            {nos.map((no) => (
              <NoArrastavel
                key={no.id}
                no={no}
                posicaoInicial={posicaoDe(no)}
                aoSoltar={registrarPosicao}
                aoTocar={() => {
                  if (no.tipo === 'setor') {
                    alternarSetor(no.rotulo);
                  } else if (no.tipo === 'competencia' && no.registro) {
                    aoSelecionar?.(no.registro);
                  }
                }}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={estilos.dica} pointerEvents="none">
        <Text style={estilos.textoDica}>
          Toque num setor para abrir · arraste os nós · pinça para zoom
        </Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------

type PropsLinhas = {
  nos: NoMapa[];
  ligacoes: { id: string; origemId: string; destinoId: string }[];
  ligacoesExtras: { id: string; origemId: string; destinoId: string }[];
  posicaoDe: (no: NoMapa) => { x: number; y: number };
};

/** Desenha as conexoes entre os nos. O SVG cobre uma area grande e centrada. */
const LinhasDoMapa: React.FC<PropsLinhas> = ({ nos, ligacoes, ligacoesExtras, posicaoDe }) => {
  const TAMANHO = 4000;
  const centro = TAMANHO / 2;

  const porId = useMemo(() => new Map(nos.map((no) => [no.id, no])), [nos]);

  const coordenada = (id: string) => {
    const no = porId.get(id);
    if (!no) {
      return null;
    }
    const posicao = posicaoDe(no);
    return { x: centro + posicao.x, y: centro + posicao.y };
  };

  return (
    <Svg
      width={TAMANHO}
      height={TAMANHO}
      style={[estilos.svg, { left: -centro, top: -centro }]}
      pointerEvents="none">
      {ligacoes.map((ligacao) => {
        const origem = coordenada(ligacao.origemId);
        const destino = coordenada(ligacao.destinoId);
        if (!origem || !destino) {
          return null;
        }

        return (
          <Line
            key={ligacao.id}
            x1={origem.x}
            y1={origem.y}
            x2={destino.x}
            y2={destino.y}
            stroke="rgba(148, 163, 184, 0.45)"
            strokeWidth={2}
          />
        );
      })}

      {ligacoesExtras.map((ligacao) => {
        const origem = coordenada(ligacao.origemId);
        const destino = coordenada(ligacao.destinoId);
        if (!origem || !destino) {
          return null;
        }

        return (
          <Line
            key={ligacao.id}
            x1={origem.x}
            y1={origem.y}
            x2={destino.x}
            y2={destino.y}
            stroke="rgba(252, 211, 77, 0.5)"
            strokeWidth={1.5}
            strokeDasharray="6 6"
          />
        );
      })}
    </Svg>
  );
};

// ---------------------------------------------------------------------------

type PropsNo = {
  no: NoMapa;
  posicaoInicial: { x: number; y: number };
  aoSoltar: (id: string, x: number, y: number) => void;
  aoTocar: () => void;
};

const NoArrastavel: React.FC<PropsNo> = ({ no, posicaoInicial, aoSoltar, aoTocar }) => {
  const x = useSharedValue(posicaoInicial.x);
  const y = useSharedValue(posicaoInicial.y);
  const inicioX = useSharedValue(0);
  const inicioY = useSharedValue(0);
  const arrastando = useSharedValue(0);

  // Se o layout automatico recalcular (ex.: expandiu uma secretaria), acompanha.
  const referencia = useRef(posicaoInicial);
  useEffect(() => {
    if (referencia.current.x !== posicaoInicial.x || referencia.current.y !== posicaoInicial.y) {
      referencia.current = posicaoInicial;
      x.value = withSpring(posicaoInicial.x, { damping: 18 });
      y.value = withSpring(posicaoInicial.y, { damping: 18 });
    }
  }, [posicaoInicial, x, y]);

  const gestoArrastar = Gesture.Pan()
    .onBegin(() => {
      inicioX.value = x.value;
      inicioY.value = y.value;
      arrastando.value = 1;
    })
    .onUpdate((evento) => {
      x.value = inicioX.value + evento.translationX;
      y.value = inicioY.value + evento.translationY;
    })
    .onEnd(() => {
      arrastando.value = 0;
      runOnJS(aoSoltar)(no.id, x.value, y.value);
    });

  const gestoToque = Gesture.Tap().maxDuration(250).onEnd(() => {
    runOnJS(aoTocar)();
  });

  // O toque so dispara se nao virou arrasto.
  const gesto = Gesture.Exclusive(gestoArrastar, gestoToque);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - no.largura / 2 },
      { translateY: y.value - no.altura / 2 },
      { scale: withSpring(arrastando.value ? 1.06 : 1, { damping: 20 }) },
    ],
  }));

  const estiloPorTipo =
    no.tipo === 'raiz'
      ? estilos.noRaiz
      : no.tipo === 'setor'
        ? estilos.noSetor
        : estilos.noCompetencia;

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View
        style={[
          estilos.no,
          estiloPorTipo,
          { width: no.largura, minHeight: no.altura, borderColor: `${no.cor}88` },
          estilo,
        ]}>
        <Text
          style={[estilos.rotuloNo, no.tipo === 'raiz' && estilos.rotuloRaiz]}
          numberOfLines={2}>
          {no.rotulo}
        </Text>
        {no.subtitulo ? (
          <Text style={estilos.subtituloNo} numberOfLines={2}>
            {no.subtitulo}
          </Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
};

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111f',
    overflow: 'hidden',
  },
  areaGesto: {
    flex: 1,
  },
  camera: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  svg: {
    position: 'absolute',
  },
  no: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  noRaiz: {
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
  },
  noSetor: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
  noCompetencia: {
    backgroundColor: 'rgba(16, 24, 40, 0.95)',
  },
  rotuloNo: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  rotuloRaiz: {
    fontSize: 18,
  },
  subtituloNo: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07111f',
  },
  textoCarregando: {
    color: '#94a3b8',
    fontSize: 14,
  },
  dica: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  textoDica: {
    color: '#64748b',
    fontSize: 11,
    backgroundColor: 'rgba(7, 17, 31, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
});

export default MapaMental;
