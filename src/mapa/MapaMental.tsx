import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import type { Registro } from '../data/registros';
import { useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import { ligacoesPorCamada, montarMapa, type NoMapa } from './layout';
import { lerPosicoes, salvarPosicoes, type PosicoesSalvas } from './posicoes';

type Props = {
  registros: Registro[];
  aoSelecionar?: (registro: Registro) => void;
  /**
   * Abre o formulario de criacao. Se um setor estiver expandido no momento,
   * MapaMental sugere os dados de lotacao dele (nova competencia no MESMO
   * setor); senao, o formulario abre em branco (nasce uma secretaria nova).
   */
  aoCriar: (sugestao?: Partial<Registro>) => void;
};

const ESCALA_MINIMA = 0.25;
const ESCALA_MAXIMA = 2.5;
const ESCALA_INICIAL = 0.75;
const FATOR_ZOOM_BOTAO = 1.35;
const MARGEM_AJUSTE_TELA = 60;

// 'worklet' é necessário porque esta função é chamada de dentro do
// .onUpdate() da pinça, que roda na UI thread — sem a diretiva, o Reanimated
// trata a referência como uma função remota e quebra ao tentar chamá-la ali.
const limitarEscala = (valor: number): number => {
  'worklet';
  return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, valor));
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
const MapaMental: React.FC<Props> = ({ registros, aoSelecionar, aoCriar }) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
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

  // Se algum setor estiver expandido, "+" cria mais uma competencia nele;
  // senao, abre em branco (o usuario nomeia uma secretaria/setor nova).
  const criarNoContexto = useCallback(() => {
    const [siglaExpandida] = expandidos;
    const registroDoSetor = siglaExpandida
      ? registros.find((r) => (r.setorSigla || r.setor) === siglaExpandida)
      : undefined;

    if (!registroDoSetor) {
      aoCriar();
      return;
    }

    aoCriar({
      departamento: registroDoSetor.departamento,
      departamentoSigla: registroDoSetor.departamentoSigla,
      departamentoResponsavel: registroDoSetor.departamentoResponsavel,
      departamentoCargo: registroDoSetor.departamentoCargo,
      setor: registroDoSetor.setor,
      setorSigla: registroDoSetor.setorSigla,
      responsavel: registroDoSetor.responsavel,
      cargo: registroDoSetor.cargo,
    });
  }, [aoCriar, expandidos, registros]);

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
  // Formula da câmera: posição na tela = posição no mundo * escala + deslocamento.
  // (ver estiloCamera abaixo — a ordem [translate, scale] do transform implica nisso)
  const deslocX = useSharedValue(larguraTela / 2);
  const deslocY = useSharedValue(alturaTela / 2);
  const escala = useSharedValue(ESCALA_INICIAL);

  const escalaInicial = useSharedValue(ESCALA_INICIAL);

  // Incremental (soma o delta desde o ultimo frame, em vez de recalcular a
  // partir do inicio do gesto) — assim compõe corretamente com o pinça
  // rodando ao mesmo tempo (Gesture.Simultaneous), sem os dois gestos
  // sobrescreverem o valor um do outro.
  const gestoPan = Gesture.Pan()
    .averageTouches(true)
    .onChange((evento) => {
      deslocX.value += evento.changeX;
      deslocY.value += evento.changeY;
    });

  // Pinça: zoom centrado no ponto ENTRE OS DEDOS (focalX/focalY), nao num
  // pivo fixo — e por isso que dá pra "beliscar" um nó específico e ele fica
  // sob os dedos em vez de escorregar para o canto da tela. O ajuste do
  // deslocamento usa a razao de escala DESDE O ULTIMO FRAME (nao desde o
  // inicio do gesto), o que permite compor com o pan simultâneo sem os dois
  // gestos brigarem pelo mesmo valor.
  const gestoPinca = Gesture.Pinch()
    .onBegin(() => {
      escalaInicial.value = escala.value;
    })
    .onUpdate((evento) => {
      const novaEscala = limitarEscala(escalaInicial.value * evento.scale);
      const fatorDesdeUltimoFrame = novaEscala / escala.value;
      deslocX.value = evento.focalX - (evento.focalX - deslocX.value) * fatorDesdeUltimoFrame;
      deslocY.value = evento.focalY - (evento.focalY - deslocY.value) * fatorDesdeUltimoFrame;
      escala.value = novaEscala;
    });

  const gestoCamera = Gesture.Simultaneous(gestoPan, gestoPinca);

  const estiloCamera = useAnimatedStyle(() => ({
    transform: [
      { translateX: deslocX.value },
      { translateY: deslocY.value },
      { scale: escala.value },
    ],
  }));

  // Aproxima/afasta mantendo o centro da tela fixo no mesmo ponto do mundo.
  const aplicarZoom = useCallback(
    (fator: number) => {
      const escalaAtual = escala.value;
      const novaEscala = limitarEscala(escalaAtual * fator);

      const centroTelaX = larguraTela / 2;
      const centroTelaY = alturaTela / 2;
      const mundoX = (centroTelaX - deslocX.value) / escalaAtual;
      const mundoY = (centroTelaY - deslocY.value) / escalaAtual;

      escala.value = withSpring(novaEscala, { damping: 20 });
      deslocX.value = withSpring(centroTelaX - mundoX * novaEscala, { damping: 20 });
      deslocY.value = withSpring(centroTelaY - mundoY * novaEscala, { damping: 20 });
    },
    [alturaTela, deslocX, deslocY, escala, larguraTela],
  );

  // Volta ao enquadramento inicial (raiz centralizada, escala padrão).
  const centralizarMapa = useCallback(() => {
    escala.value = withSpring(ESCALA_INICIAL, { damping: 20 });
    deslocX.value = withSpring(larguraTela / 2, { damping: 20 });
    deslocY.value = withSpring(alturaTela / 2, { damping: 20 });
  }, [alturaTela, deslocX, deslocY, escala, larguraTela]);

  // Calcula a caixa que envolve todos os nós visíveis e ajusta escala/deslocamento
  // para que caibam inteiros na tela (com margem), centralizados.
  const ajustarATela = useCallback(() => {
    if (nos.length === 0) {
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nos.forEach((no) => {
      const posicao = posicaoDe(no);
      minX = Math.min(minX, posicao.x - no.largura / 2);
      maxX = Math.max(maxX, posicao.x + no.largura / 2);
      minY = Math.min(minY, posicao.y - no.altura / 2);
      maxY = Math.max(maxY, posicao.y + no.altura / 2);
    });

    const larguraConteudo = Math.max(maxX - minX, 1);
    const alturaConteudo = Math.max(maxY - minY, 1);

    const novaEscala = limitarEscala(
      Math.min(
        (larguraTela - MARGEM_AJUSTE_TELA * 2) / larguraConteudo,
        (alturaTela - MARGEM_AJUSTE_TELA * 2) / alturaConteudo,
      ),
    );

    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;

    escala.value = withSpring(novaEscala, { damping: 20 });
    deslocX.value = withSpring(larguraTela / 2 - centroX * novaEscala, { damping: 20 });
    deslocY.value = withSpring(alturaTela / 2 - centroY * novaEscala, { damping: 20 });
  }, [alturaTela, deslocX, deslocY, escala, larguraTela, nos, posicaoDe]);

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
              tema={tema}
              nos={nos}
              ligacoes={ligacoes}
              ligacoesExtras={ligacoesExtras}
              posicaoDe={posicaoDe}
            />

            {nos.map((no) => (
              <NoArrastavel
                key={no.id}
                tema={tema}
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
          Toque num setor para abrir · arraste os nós · pinça ou +/− para zoom
        </Text>
      </View>

      <View style={estilos.barraSuperior} pointerEvents="box-none">
        <ControleTexto tema={tema} rotulo="Ajustar à tela" aoTocar={ajustarATela} />
        <ControleTexto tema={tema} rotulo="Centralizar" aoTocar={centralizarMapa} />
      </View>

      <View style={estilos.pilhaZoom} pointerEvents="box-none">
        <ControleIcone
          tema={tema}
          rotulo="+"
          descricao="Aumentar zoom"
          aoTocar={() => aplicarZoom(FATOR_ZOOM_BOTAO)}
        />
        <View style={estilos.separadorZoom} />
        <ControleIcone
          tema={tema}
          rotulo="–"
          descricao="Diminuir zoom"
          aoTocar={() => aplicarZoom(1 / FATOR_ZOOM_BOTAO)}
        />
      </View>

      <Pressable
        onPress={criarNoContexto}
        style={estilos.fab}
        accessibilityRole="button"
        accessibilityLabel={
          expandidos.size > 0
            ? 'Adicionar competência a este setor'
            : 'Adicionar nova secretaria ou setor'
        }>
        <Text style={estilos.textoFab}>+</Text>
      </Pressable>
    </View>
  );
};

// ---------------------------------------------------------------------------

/** Botão de texto usado na barra superior ("Ajustar à tela", "Centralizar"). */
const ControleTexto: React.FC<{ tema: Tema; rotulo: string; aoTocar: () => void }> = ({
  tema,
  rotulo,
  aoTocar,
}) => {
  const estilos = criarEstilos(tema);
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
      style={({ pressed }) => [estilos.botaoTexto, pressed && estilos.botaoPressionado]}>
      <Text style={estilos.textoBotaoTexto}>{rotulo}</Text>
    </Pressable>
  );
};

/** Botão circular usado na pilha de zoom (+/-). */
const ControleIcone: React.FC<{ tema: Tema; rotulo: string; descricao: string; aoTocar: () => void }> = ({
  tema,
  rotulo,
  descricao,
  aoTocar,
}) => {
  const estilos = criarEstilos(tema);
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={descricao}
      hitSlop={8}
      style={({ pressed }) => [estilos.botaoIcone, pressed && estilos.botaoPressionado]}>
      <Text style={estilos.textoBotaoIcone}>{rotulo}</Text>
    </Pressable>
  );
};

type PropsLinhas = {
  tema: Tema;
  nos: NoMapa[];
  ligacoes: { id: string; origemId: string; destinoId: string }[];
  ligacoesExtras: { id: string; origemId: string; destinoId: string }[];
  posicaoDe: (no: NoMapa) => { x: number; y: number };
};

const PADDING_SVG_LINHAS = 40;

/**
 * Desenha as conexoes entre os nos. O SVG e dimensionado dinamicamente pela
 * caixa que envolve os nos atuais (nao um tamanho fixo): um canvas fixo
 * grande o bastante para mapas grandes gera um bitmap gigante em telas de
 * alta densidade e o Android recusa desenhar ("Canvas: trying to draw too
 * large bitmap"), enquanto um canvas pequeno demais corta linhas fora dele.
 */
const LinhasDoMapa: React.FC<PropsLinhas> = ({ tema, nos, ligacoes, ligacoesExtras, posicaoDe }) => {
  const estilos = criarEstilos(tema);
  const corLinha = tema.modo === 'escuro' ? 'rgba(148, 163, 184, 0.45)' : 'rgba(100, 116, 139, 0.4)';
  const corLinhaCamada = tema.modo === 'escuro' ? 'rgba(252, 211, 77, 0.5)' : 'rgba(180, 83, 9, 0.55)';

  const porId = useMemo(() => new Map(nos.map((no) => [no.id, no])), [nos]);

  const limites = useMemo(() => {
    if (nos.length === 0) {
      return { minX: 0, minY: 0, largura: 0, altura: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nos.forEach((no) => {
      const posicao = posicaoDe(no);
      minX = Math.min(minX, posicao.x - no.largura / 2);
      maxX = Math.max(maxX, posicao.x + no.largura / 2);
      minY = Math.min(minY, posicao.y - no.altura / 2);
      maxY = Math.max(maxY, posicao.y + no.altura / 2);
    });

    return {
      minX: minX - PADDING_SVG_LINHAS,
      minY: minY - PADDING_SVG_LINHAS,
      largura: maxX - minX + PADDING_SVG_LINHAS * 2,
      altura: maxY - minY + PADDING_SVG_LINHAS * 2,
    };
  }, [nos, posicaoDe]);

  const coordenada = (id: string) => {
    const no = porId.get(id);
    if (!no) {
      return null;
    }
    const posicao = posicaoDe(no);
    return { x: posicao.x - limites.minX, y: posicao.y - limites.minY };
  };

  if (nos.length === 0) {
    return null;
  }

  return (
    <Svg
      width={limites.largura}
      height={limites.altura}
      style={[estilos.svg, { left: limites.minX, top: limites.minY }]}
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
            stroke={corLinha}
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
            stroke={corLinhaCamada}
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
  tema: Tema;
  no: NoMapa;
  posicaoInicial: { x: number; y: number };
  aoSoltar: (id: string, x: number, y: number) => void;
  aoTocar: () => void;
};

const NoArrastavel: React.FC<PropsNo> = ({ tema, no, posicaoInicial, aoSoltar, aoTocar }) => {
  const estilos = criarEstilos(tema);
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
        {no.registro?.favorito ? <Text style={estilos.estrelaNo}>★</Text> : null}
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

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tema.fundo,
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
      backgroundColor: tema.primariaFundo,
    },
    noSetor: {
      backgroundColor: tema.fundoElevado,
    },
    noCompetencia: {
      backgroundColor: tema.superficie,
    },
    rotuloNo: {
      color: tema.texto,
      fontSize: 13,
      fontWeight: '700',
    },
    rotuloRaiz: {
      fontSize: 18,
    },
    subtituloNo: {
      color: tema.textoSecundario,
      fontSize: 11,
      marginTop: 4,
    },
    estrelaNo: {
      position: 'absolute',
      top: 6,
      right: 8,
      color: tema.favorito,
      fontSize: 12,
    },
    carregando: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tema.fundo,
    },
    textoCarregando: {
      color: tema.textoSecundario,
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
      color: tema.textoSecundario,
      fontSize: 11,
      backgroundColor: tema.fundoElevado,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: tema.borda,
    },
    barraSuperior: {
      position: 'absolute',
      top: 12,
      left: 16,
      right: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 8,
    },
    botaoTexto: {
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    textoBotaoTexto: {
      color: tema.primariaTexto,
      fontSize: 11,
      fontWeight: '700',
    },
    pilhaZoom: {
      position: 'absolute',
      right: 16,
      bottom: 64,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 22,
      overflow: 'hidden',
    },
    botaoIcone: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoBotaoIcone: {
      color: tema.primariaTexto,
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 22,
    },
    separadorZoom: {
      height: 1,
      backgroundColor: tema.borda,
    },
    botaoPressionado: {
      backgroundColor: tema.primariaFundo,
    },
    fab: {
      position: 'absolute',
      left: 20,
      bottom: 64,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: tema.primaria,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    textoFab: { color: tema.textoInvertido, fontSize: 26, fontWeight: '600', lineHeight: 28 },
  });

export default MapaMental;
