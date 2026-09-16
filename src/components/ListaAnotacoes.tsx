import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Text, View, type ListRenderItemInfo } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInUp,
  LinearTransition,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';
import BarraBusca from './BarraBusca';
import NumeroTocavel from './NumeroTocavel';
import {
  textoPesquisavelDaAnotacao,
  tituloDaAnotacao,
  valoresPreenchidos,
  type Anotacao,
  type Campo,
} from '../data/campos';
import { criarEstilosEscalaveis } from '../tema/estilos';
import { limitarEscalaTexto } from '../tema/responsivo';
import { useEscalaTexto, useEstilos, useMetricas, useTema } from '../tema/ThemeContext';

type Props = {
  campo: Campo;
  anotacoes: Anotacao[];
  aoAbrir: (anotacao: Anotacao) => void;
  aoCriar: () => void;
};

const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Lista de um campo livre — o equivalente da ListaRegistros para os cofres que
 * o usuário cria. Os cartões são montados a partir do formulário do campo, não
 * de um modelo fixo: o primeiro requisito vira o título e o resto aparece como
 * rótulo + valor, na ordem em que foi definido.
 */
const ListaAnotacoes: React.FC<Props> = ({ campo, anotacoes, aoAbrir, aoCriar }) => {
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosAnotacoes);
  const [escalaTexto, definirEscalaTexto] = useEscalaTexto();

  const [termoBusca, setTermoBusca] = useState('');
  const [termoAplicado, setTermoAplicado] = useState('');

  // A busca aqui é local e síncrona: o módulo nativo trabalha sobre os campos
  // do levantamento do SIG, que um campo livre não tem.
  useEffect(() => {
    const temporizador = setTimeout(() => setTermoAplicado(termoBusca.trim()), 200);
    return () => clearTimeout(temporizador);
  }, [termoBusca]);

  const visiveis = useMemo(() => {
    if (!termoAplicado) {
      return anotacoes;
    }
    const alvo = normalizar(termoAplicado);
    return anotacoes.filter((anotacao) =>
      normalizar(textoPesquisavelDaAnotacao(campo, anotacao)).includes(alvo),
    );
  }, [anotacoes, campo, termoAplicado]);

  // Mesma pinça da lista do SIG: dois dedos ajustam o tamanho do texto.
  const escalaAoIniciar = useSharedValue(escalaTexto);
  const escalaAplicada = useSharedValue(escalaTexto);

  useEffect(() => {
    escalaAplicada.value = escalaTexto;
  }, [escalaTexto, escalaAplicada]);

  const gestoPinca = Gesture.Pinch()
    .onBegin(() => {
      escalaAoIniciar.value = escalaAplicada.value;
    })
    .onChange((evento) => {
      const proxima = limitarEscalaTexto(escalaAoIniciar.value * evento.scale);
      if (proxima !== escalaAplicada.value) {
        escalaAplicada.value = proxima;
        runOnJS(definirEscalaTexto)(proxima);
      }
    });

  const renderizar = useCallback(
    ({ item, index }: ListRenderItemInfo<Anotacao>) => (
      <CartaoAnotacao
        campo={campo}
        anotacao={item}
        indice={index}
        aoAbrir={aoAbrir}
      />
    ),
    [campo, aoAbrir],
  );

  const cabecalho = (
    <Animated.View entering={FadeInUp.duration(400)} style={estilos.cabecalho}>
      <Text style={estilos.selo}>Campo</Text>
      <Text style={estilos.titulo}>{campo.nome}</Text>
      <Text style={estilos.subtitulo}>
        {visiveis.length} de {anotacoes.length} {anotacoes.length === 1 ? 'item' : 'itens'} ·{' '}
        {campo.formulario.length} campo{campo.formulario.length === 1 ? '' : 's'} no cadastro
      </Text>

      <BarraBusca
        valor={termoBusca}
        aoAlterar={setTermoBusca}
        aoPesquisar={() => setTermoAplicado(termoBusca.trim())}
        placeholder={`Buscar em ${campo.nome}...`}
      />
    </Animated.View>
  );

  const vazio = (
    <View style={estilos.estadoVazio}>
      <Text style={estilos.textoEstadoVazio}>
        {anotacoes.length === 0
          ? `Nenhum item em ${campo.nome} ainda. Toque em + para cadastrar o primeiro.`
          : `Nenhum item encontrado para "${termoAplicado}".`}
      </Text>
    </View>
  );

  return (
    <View style={estilos.container}>
      <GestureDetector gesture={gestoPinca}>
        <FlatList
          key={`colunas-${metricas.colunas}`}
          data={visiveis}
          keyExtractor={(anotacao) => anotacao.id}
          renderItem={renderizar}
          numColumns={metricas.colunas}
          columnWrapperStyle={metricas.colunas > 1 ? estilos.linhaGrade : undefined}
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={vazio}
          contentContainerStyle={estilos.conteudoLista}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      </GestureDetector>

      <Pressable
        onPress={aoCriar}
        style={estilos.fab}
        accessibilityRole="button"
        accessibilityLabel={`Adicionar item em ${campo.nome}`}>
        <Text style={estilos.textoFab}>+</Text>
      </Pressable>
    </View>
  );
};

const CartaoAnotacaoBase: React.FC<{
  campo: Campo;
  anotacao: Anotacao;
  indice: number;
  aoAbrir: (anotacao: Anotacao) => void;
}> = ({ campo, anotacao, indice, aoAbrir }) => {
  const tema = useTema();
  const estilos = useEstilos(criarEstilosAnotacoes);

  const titulo = tituloDaAnotacao(campo, anotacao);
  // O título já aparece no topo do cartão; o resto vira as linhas de detalhe.
  const detalhes = valoresPreenchidos(campo, anotacao).slice(1, 5);

  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(indice, 8) * 60).springify()}
      layout={LinearTransition.springify()}
      style={[estilos.itemGrade, estilos.cartao]}>
      <Pressable
        android_ripple={{ color: tema.superficieAtiva }}
        onPress={() => aoAbrir(anotacao)}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        style={estilos.areaCartao}>
        <NumeroTocavel texto={titulo} estiloTexto={estilos.tituloCartao} numberOfLines={2} />

        {/* Um valor que é sequência de números vira telefone: toque copia,
            segurar abre o discador (ver NumeroTocavel). */}
        {detalhes.map(({ requisito, texto }) => (
          <View key={requisito.id} style={estilos.bloco}>
            <Text style={estilos.rotulo}>{requisito.rotulo}</Text>
            <NumeroTocavel texto={texto} estiloTexto={estilos.valor} numberOfLines={3} />
          </View>
        ))}
      </Pressable>
    </Animated.View>
  );
};

const CartaoAnotacao = React.memo(CartaoAnotacaoBase);

const criarEstilosAnotacoes = criarEstilosEscalaveis((tema, m) => ({
  container: { flex: 1, backgroundColor: tema.fundo },
  cabecalho: { paddingTop: 12 },
  selo: {
    color: tema.primariaTexto,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  titulo: {
    color: tema.texto,
    fontSize: m.compacta ? 24 : m.expandida ? 32 : 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  subtitulo: { marginTop: 4, marginBottom: 16, color: tema.textoSecundario, fontSize: 13 },
  conteudoLista: {
    width: '100%',
    maxWidth: m.colunas > 1 ? 1200 : m.larguraMaxConteudo,
    alignSelf: 'center',
    paddingHorizontal: m.margem,
    paddingBottom: 96,
  },
  linhaGrade: { gap: m.espaco },
  itemGrade: m.colunas > 1 ? { flex: 1, maxWidth: `${100 / m.colunas}%` } : {},
  cartao: {
    borderRadius: 22,
    marginBottom: m.espaco,
    borderWidth: 1,
    borderColor: tema.borda,
    overflow: 'hidden',
    backgroundColor: tema.fundoElevado,
    shadowColor: tema.sombra,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: tema.modo === 'escuro' ? 0.26 : 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  areaCartao: { padding: m.compacta ? 14 : 18 },
  tituloCartao: { color: tema.texto, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  bloco: { marginTop: 12 },
  rotulo: {
    color: tema.textoTerciario,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  valor: { color: tema.textoSecundario, fontSize: 13, lineHeight: 19 },
  estadoVazio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  textoEstadoVazio: { color: tema.textoSecundario, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: m.margem,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tema.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: tema.sombra,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  textoFab: { color: tema.textoInvertido, fontSize: 28, fontWeight: '600', lineHeight: 30 },
}));

export default ListaAnotacoes;
