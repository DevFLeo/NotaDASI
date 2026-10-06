import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, type ListRenderItemInfo } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import BarraBusca from './BarraBusca';
import {
  camposDaLinha,
  caminhoDaLinha,
  filtrarLinhas,
  tituloDaLinha,
  type AbaPlanilha,
  type LinhaPlanilha,
} from '../data/planilha';
import { abasPlanilha, origemPlanilha } from '../data/planilha.gerado';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useMetricas } from '../tema/ThemeContext';

/** Quantos campos o cartão fechado mostra antes do "ver tudo". */
const CAMPOS_RESUMO = 4;

const CartaoLinhaBase: React.FC<{ aba: AbaPlanilha; linha: LinhaPlanilha }> = ({ aba, linha }) => {
  const estilos = useEstilos(criarEstilosPlanilha);
  const [aberto, setAberto] = useState(false);

  const campos = camposDaLinha(aba, linha);
  const visiveis = aberto ? campos : campos.slice(0, CAMPOS_RESUMO);
  const ocultos = campos.length - visiveis.length;
  const caminho = caminhoDaLinha(aba, linha);

  return (
    <Pressable
      onPress={() => setAberto((atual) => !atual)}
      disabled={campos.length <= CAMPOS_RESUMO}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      style={estilos.cartao}>
      <Text style={estilos.numeroLinha}>Linha {linha.linha}</Text>
      <Text style={estilos.tituloCartao}>{tituloDaLinha(aba, linha)}</Text>
      {caminho ? <Text style={estilos.caminho}>{caminho}</Text> : null}

      {visiveis.map((campo, indice) => (
        <View key={`${indice}-${campo.coluna}`} style={estilos.campo}>
          <Text style={estilos.rotuloCampo}>{campo.coluna}</Text>
          <Text style={estilos.valorCampo} numberOfLines={aberto ? undefined : 3}>
            {campo.valor}
          </Text>
        </View>
      ))}

      {campos.length === 0 ? (
        <Text style={estilos.semCampos}>Sem outras informações nesta linha.</Text>
      ) : null}

      {campos.length > CAMPOS_RESUMO ? (
        <Text style={estilos.verMais}>
          {aberto ? 'Mostrar menos' : `Ver tudo (+${ocultos} campo${ocultos === 1 ? '' : 's'})`}
        </Text>
      ) : null}
    </Pressable>
  );
};

const CartaoLinha = React.memo(CartaoLinhaBase);

/**
 * Tela "Planilha": a pasta de trabalho do diagnóstico inteira, uma aba por vez,
 * como no Excel. Serve para consultar o que o levantamento não interpreta (as
 * abas de resumo) e para conferir qualquer linha contra o arquivo original.
 */
const PlanilhaTela: React.FC = () => {
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosPlanilha);

  const [indiceAba, setIndiceAba] = useState(0);
  const [termo, setTermo] = useState('');

  const aba = abasPlanilha[indiceAba] ?? abasPlanilha[0];
  const linhas = useMemo(() => (aba ? filtrarLinhas(aba, termo) : []), [aba, termo]);

  const renderizar = useCallback(
    ({ item }: ListRenderItemInfo<LinhaPlanilha>) => <CartaoLinha aba={aba} linha={item} />,
    [aba],
  );

  const cabecalho = (
    <Animated.View entering={FadeInUp.duration(400)} style={estilos.cabecalho}>
      <Text style={estilos.titulo}>Planilha</Text>
      <Text style={estilos.subtitulo}>
        {origemPlanilha} · {abasPlanilha.length} abas
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={estilos.rolagemAbas}
        contentContainerStyle={estilos.faixaAbas}>
        {abasPlanilha.map((item, indice) => {
          const ativa = indice === indiceAba;
          return (
            <Pressable
              key={item.nome}
              onPress={() => setIndiceAba(indice)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              style={[estilos.chip, ativa && estilos.chipAtivo]}>
              <Text
                style={[estilos.textoChip, ativa && estilos.textoChipAtivo]}
                maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                {item.nome}
              </Text>
              <Text
                style={[estilos.contagemChip, ativa && estilos.textoChipAtivo]}
                maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                {item.linhas.length}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {aba && aba.linhas.length > 0 ? (
        <>
          <BarraBusca
            valor={termo}
            aoAlterar={setTermo}
            aoPesquisar={() => undefined}
            placeholder={`Buscar em ${aba.nome}...`}
          />
          <Text style={estilos.contagem}>
            {linhas.length} de {aba.linhas.length} linha{aba.linhas.length === 1 ? '' : 's'}
          </Text>
        </>
      ) : null}
    </Animated.View>
  );

  const vazio = (
    <View style={estilos.estadoVazio}>
      <Text style={estilos.textoEstadoVazio}>
        {aba && aba.linhas.length === 0
          ? `A aba "${aba.nome}" está vazia na planilha.`
          : `Nenhuma linha encontrada para "${termo}".`}
      </Text>
    </View>
  );

  return (
    <View style={estilos.container}>
      <FlatList
        // Trocar de aba recomeça a lista do topo, em vez de herdar a rolagem.
        key={aba?.nome}
        data={linhas}
        keyExtractor={(linha) => String(linha.linha)}
        renderItem={renderizar}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={vazio}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={9}
      />
    </View>
  );
};

const criarEstilosPlanilha = criarEstilos((tema, m) => ({
  container: { flex: 1, backgroundColor: tema.fundo },
  conteudo: {
    width: '100%',
    maxWidth: m.larguraMaxConteudo,
    alignSelf: 'center',
    paddingHorizontal: m.margem,
    paddingBottom: 32,
  },
  cabecalho: { paddingTop: 12 },
  titulo: {
    color: tema.texto,
    fontSize: m.compacta ? 24 : m.expandida ? 32 : 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitulo: { marginTop: 4, marginBottom: 16, color: tema.textoSecundario, fontSize: 13 },
  rolagemAbas: { marginHorizontal: -m.margem },
  faixaAbas: { gap: 8, paddingBottom: 14, paddingHorizontal: m.margem },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chipAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
  textoChip: { color: tema.textoSecundario, fontSize: 12, fontWeight: '600' },
  contagemChip: { color: tema.textoTerciario, fontSize: 11, fontWeight: '700' },
  textoChipAtivo: { color: tema.primariaTexto },
  contagem: { color: tema.textoSecundario, fontSize: 12, marginTop: 10, marginBottom: 12 },
  cartao: {
    borderRadius: 18,
    marginBottom: m.espaco,
    padding: m.compacta ? 14 : 18,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  numeroLinha: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tituloCartao: { color: tema.texto, fontSize: 15, fontWeight: '700', marginTop: 4, lineHeight: 21 },
  caminho: { color: tema.textoSecundario, fontSize: 12, marginTop: 4, lineHeight: 17 },
  campo: { marginTop: 12 },
  rotuloCampo: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valorCampo: { color: tema.texto, fontSize: 13, lineHeight: 19, marginTop: 2 },
  semCampos: { color: tema.textoTerciario, fontSize: 12, marginTop: 10 },
  verMais: { color: tema.primariaTexto, fontSize: 12, fontWeight: '700', marginTop: 12 },
  estadoVazio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  textoEstadoVazio: { color: tema.textoSecundario, fontSize: 14, textAlign: 'center' },
}));

export default PlanilhaTela;
