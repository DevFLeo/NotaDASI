import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AjustesTela from '../src/components/AjustesTela';
import ListaAnotacoes from '../src/components/ListaAnotacoes';
import ListaRegistros from '../src/components/ListaRegistros';
import MenuCampos from '../src/components/MenuCampos';
import PlanilhaTela from '../src/components/PlanilhaTela';
import MapaMental from '../src/mapa/MapaMental';
import Modais from '../src/app/Modais';
import { useAplicacao } from '../src/app/useAplicacao';
import { useSessao } from '../src/auth/useSessao';
import { criarEstilos } from '../src/tema/estilos';
import { AreaDeLayout, useEstilos, useMetricas, useTema } from '../src/tema/ThemeContext';
import { IconeEngrenagem, IconeLista, IconePlanilha } from '../src/tema/Icones';

/**
 * Casca do PC: barra lateral à esquerda, mapa mental em foco à direita.
 *
 * O celular mostra uma tela por vez porque não cabe mais que isso. No monitor
 * cabe, e a pergunta muda: o que fica SEMPRE visível? A resposta aqui é o mapa
 * mental — ele é a visão do conjunto, e é o que perde mais ao ser espiado em
 * pedaços. Lista, Ajustes e Campos entram como painel ao lado dele, nunca por
 * cima: quem abre a lista continua vendo onde aquele item está no mapa.
 *
 * Três regras de layout, todas pedidas para esta tela:
 *
 * 1. **Barra lateral** com Lista, Planilha e Ajustes.
 * 2. **Acionar um item da barra a reduz** para os ícones — o rótulo já cumpriu
 *    a função de explicar, e o espaço vale mais para o painel que abriu.
 * 3. **Painel 35 / mapa 65**, seja a lista, sejam os Ajustes, seja a tabela de
 *    criação de campo. Um número só, para o olho não ter que reaprender a
 *    proporção a cada troca de painel.
 *
 * Esta casca NÃO tem estado próprio de dados: tudo vem de `useAplicacao()`, o
 * mesmo hook que o App.tsx do celular usa. O que é só daqui é a geometria.
 */

type Painel = 'lista' | 'planilha' | 'ajustes' | 'campos' | null;

const LARGURA_BARRA = 216;
const LARGURA_BARRA_REDUZIDA = 76;

/**
 * Abaixo disto a barra fica sempre reduzida: com painel aberto, os rótulos
 * comeriam a largura que a lista precisa para os cartões não quebrarem.
 */
const LIMITE_BARRA_LARGA = 1180;

const CHAVE_PAINEL = '@notadasi:pc-painel';
const CHAVE_BARRA = '@notadasi:pc-barra-reduzida';

/** Seta de recolher/expandir a barra. Só existe no PC, por isso mora aqui. */
const IconeSeta: React.FC<{ tamanho?: number; cor: string; paraDireita: boolean }> = ({
  tamanho = 18,
  cor,
  paraDireita,
}) => (
  <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
    <Path
      d={paraDireita ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
      stroke={cor}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CascaPC: React.FC = () => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosPC);
  const app = useAplicacao();
  const { contaAtual } = useSessao();

  const [painel, setPainel] = useState<Painel>(null);
  const [barraReduzidaSalva, setBarraReduzidaSalva] = useState(false);

  /**
   * Tamanho real do painel, medido.
   *
   * A lista pergunta "qual a largura?" para decidir quantas colunas desenhar.
   * Se a resposta for a da JANELA, num monitor de 1920px ela se acha em tela
   * grande e faz três colunas dentro dos 35% — cartões de ~190px. Medindo e
   * passando por <AreaDeLayout>, tudo que está no painel responde ao painel.
   */
  const [areaPainel, setAreaPainel] = useState({ largura: 0, altura: 0 });

  const medirPainel = useCallback((evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setAreaPainel((atual) =>
      Math.abs(atual.largura - width) < 1 && Math.abs(atual.altura - height) < 1
        ? atual
        : { largura: width, altura: height },
    );
  }, []);

  // A janela estreita manda mais que a preferência: não adianta o usuário
  // querer a barra larga se ela deixa o painel sem espaço.
  const barraReduzida = barraReduzidaSalva || metricas.largura < LIMITE_BARRA_LARGA;

  // Recupera o último layout. É o mesmo armazenamento do resto do app
  // (IndexedDB, via AsyncStorage), então reabrir a aba devolve a tela como
  // estava — inclusive qual painel estava aberto.
  useEffect(() => {
    let ativo = true;

    Promise.all([AsyncStorage.getItem(CHAVE_PAINEL), AsyncStorage.getItem(CHAVE_BARRA)]).then(
      ([painelSalvo, barraSalva]) => {
        if (!ativo) {
          return;
        }
        if (
          painelSalvo === 'lista' ||
          painelSalvo === 'planilha' ||
          painelSalvo === 'ajustes' ||
          painelSalvo === 'campos'
        ) {
          setPainel(painelSalvo);
        }
        setBarraReduzidaSalva(barraSalva === 'sim');
      },
    );

    return () => {
      ativo = false;
    };
  }, []);

  const guardarPainel = useCallback((proximo: Painel) => {
    setPainel(proximo);
    if (proximo) {
      AsyncStorage.setItem(CHAVE_PAINEL, proximo).catch(() => {});
    } else {
      AsyncStorage.removeItem(CHAVE_PAINEL).catch(() => {});
    }
  }, []);

  const guardarBarra = useCallback((reduzida: boolean) => {
    setBarraReduzidaSalva(reduzida);
    AsyncStorage.setItem(CHAVE_BARRA, reduzida ? 'sim' : 'nao').catch(() => {});
  }, []);

  /**
   * Um clique na barra faz duas coisas: abre (ou fecha) o painel e reduz a
   * barra. Clicar de novo no item aberto fecha o painel e devolve o mapa
   * inteiro — é o caminho de volta para o foco.
   */
  const acionar = useCallback(
    (alvo: Exclude<Painel, null>) => {
      if (painel === alvo) {
        guardarPainel(null);
        return;
      }
      guardarPainel(alvo);
      guardarBarra(true);
    },
    [painel, guardarPainel, guardarBarra],
  );

  const fecharPainel = useCallback(() => guardarPainel(null), [guardarPainel]);

  const tituloPainel =
    painel === 'lista'
      ? app.campoAtivo.nome
      : painel === 'planilha'
        ? 'Planilha'
        : painel === 'ajustes'
          ? 'Ajustes'
          : painel === 'campos'
            ? 'Campos'
            : '';

  return (
    <View style={estilos.raiz}>
      {/* Barra de cima: à esquerda, a troca de campo — o pedido era que a
          opção ficasse no canto superior esquerdo, antes de qualquer outra
          coisa, porque é ela que decide o que todo o resto da tela mostra. */}
      <View style={estilos.topo}>
        <Pressable
          onPress={() => acionar('campos')}
          accessibilityRole="button"
          accessibilityState={{ selected: painel === 'campos' }}
          accessibilityLabel={`Campo ativo: ${app.campoAtivo.nome}. Clique para trocar de campo.`}
          style={[estilos.botaoCampo, painel === 'campos' && estilos.botaoCampoAtivo]}>
          <Text style={estilos.rotuloCampo}>Campo</Text>
          <Text style={estilos.nomeCampo} numberOfLines={1}>
            {app.campoAtivo.nome}
          </Text>
          <IconeSeta tamanho={14} cor={tema.textoSecundario} paraDireita={painel !== 'campos'} />
        </Pressable>

        <View style={estilos.tituloTopo}>
          <Text style={estilos.marca}>NotaDASI</Text>
          <Text style={estilos.subtitulo} numberOfLines={1}>
            Mapa mental{tituloPainel ? ` · ${tituloPainel}` : ''}
          </Text>
        </View>

        {contaAtual ? (
          <Pressable
            onPress={() => acionar('ajustes')}
            accessibilityRole="button"
            accessibilityLabel={`Conta ${contaAtual.nome}. Clique para abrir os ajustes.`}
            style={estilos.chipConta}>
            <View style={estilos.avatar}>
              <Text style={estilos.inicial}>{contaAtual.nome.slice(0, 1)}</Text>
            </View>
            <Text style={estilos.nomeConta} numberOfLines={1}>
              {contaAtual.nome}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={estilos.corpo}>
        <View
          style={[estilos.barra, { width: barraReduzida ? LARGURA_BARRA_REDUZIDA : LARGURA_BARRA }]}>
          <ItemBarra
            rotulo="Lista"
            Icone={IconeLista}
            ativo={painel === 'lista'}
            reduzida={barraReduzida}
            aoTocar={() => acionar('lista')}
          />
          <ItemBarra
            rotulo="Planilha"
            Icone={IconePlanilha}
            ativo={painel === 'planilha'}
            reduzida={barraReduzida}
            aoTocar={() => acionar('planilha')}
          />
          <ItemBarra
            rotulo="Ajustes"
            Icone={IconeEngrenagem}
            ativo={painel === 'ajustes'}
            reduzida={barraReduzida}
            aoTocar={() => acionar('ajustes')}
          />

          <View style={estilos.espacador} />

          {/* Só aparece onde a escolha existe: abaixo de LIMITE_BARRA_LARGA a
              barra fica reduzida de qualquer jeito, e um botão que não obedece
              é pior que botão nenhum. */}
          {metricas.largura >= LIMITE_BARRA_LARGA ? (
            <Pressable
              onPress={() => guardarBarra(!barraReduzida)}
              accessibilityRole="button"
              accessibilityLabel={barraReduzida ? 'Expandir a barra' : 'Reduzir a barra'}
              style={estilos.botaoRecolher}>
              <IconeSeta tamanho={16} cor={tema.textoSecundario} paraDireita={barraReduzida} />
              {barraReduzida ? null : <Text style={estilos.textoRecolher}>Reduzir</Text>}
            </Pressable>
          ) : null}
        </View>

        {/* 35 / 65. Os dois `flex` dividem o que sobra depois da barra, então a
            proporção vale entre painel e mapa — que é onde ela importa. */}
        {painel ? (
          <View style={estilos.painel} onLayout={medirPainel}>
            <AreaDeLayout largura={areaPainel.largura} altura={areaPainel.altura}>
              {painel === 'lista' ? (
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
              ) : painel === 'planilha' ? (
                <PlanilhaTela />
              ) : painel === 'ajustes' ? (
                <AjustesTela
                  origem={app.origem}
                  totalRegistros={app.registros.length}
                  aoLimparDados={app.limparDadosLocais}
                  campoAtivo={app.campoAtivo}
                  totalCampos={app.campos.length}
                  aoAbrirCampos={() => acionar('campos')}
                />
              ) : (
                <MenuCampos
                  embutido
                  visivel
                  campos={app.campos}
                  campoAtivo={app.campoAtivo}
                  contarItens={app.contarItens}
                  aoFechar={fecharPainel}
                  aoTrocar={app.definirCampoAtivo}
                  aoCriar={app.criarCampo}
                  aoAtualizar={app.atualizarCampo}
                  aoExcluir={app.excluirCampo}
                />
              )}
            </AreaDeLayout>
          </View>
        ) : null}

        <View style={estilos.mapa}>
          <MapaMental
            campo={app.campoAtivo}
            registros={app.registros}
            anotacoes={app.anotacoes}
            aoSelecionar={app.setSelecionado}
            aoCriar={app.abrirCriacao}
            aoAbrirAnotacao={app.abrirAnotacao}
            aoCriarAnotacao={app.criarNovaAnotacao}
          />
        </View>
      </View>

      {/* `ocultarMenuCampos` porque aqui os campos são o painel de 35%, não uma
          folha que sobe — ver o comentário em src/app/Modais.tsx. */}
      <Modais app={app} ocultarMenuCampos />
    </View>
  );
};

const ItemBarra: React.FC<{
  rotulo: string;
  Icone: React.FC<{ tamanho?: number; cor: string }>;
  ativo: boolean;
  reduzida: boolean;
  aoTocar: () => void;
}> = ({ rotulo, Icone, ativo, reduzida, aoTocar }) => {
  const tema = useTema();
  const estilos = useEstilos(criarEstilosPC);
  const cor = ativo ? tema.primariaTexto : tema.textoSecundario;

  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={rotulo}
      style={[estilos.item, reduzida && estilos.itemReduzido, ativo && estilos.itemAtivo]}>
      <Icone tamanho={20} cor={cor} />
      {reduzida ? null : (
        <Text style={[estilos.textoItem, ativo && estilos.textoItemAtivo]} numberOfLines={1}>
          {rotulo}
        </Text>
      )}
    </Pressable>
  );
};

const criarEstilosPC = criarEstilos((tema) => ({
  raiz: { flex: 1, backgroundColor: tema.fundo },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  botaoCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  botaoCampoAtivo: { borderColor: tema.primaria, backgroundColor: tema.primariaFundo },
  rotuloCampo: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nomeCampo: { color: tema.texto, fontSize: 13, fontWeight: '700', flexShrink: 1 },

  tituloTopo: { flex: 1, minWidth: 0 },
  marca: {
    color: tema.primariaTexto,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitulo: { color: tema.textoSecundario, fontSize: 12, marginTop: 2 },

  chipConta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    maxWidth: 260,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.primariaFundo,
  },
  inicial: { color: tema.primariaTexto, fontSize: 13, fontWeight: '800' },
  nomeConta: { color: tema.texto, fontSize: 12, fontWeight: '700', flexShrink: 1 },

  corpo: { flex: 1, flexDirection: 'row', minHeight: 0 },

  barra: {
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tema.superficie,
  },
  itemReduzido: { justifyContent: 'center', paddingHorizontal: 0 },
  itemAtivo: { backgroundColor: tema.primariaFundo },
  textoItem: {
    color: tema.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  textoItemAtivo: { color: tema.primariaTexto },
  espacador: { flex: 1 },
  botaoRecolher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: tema.superficie,
  },
  textoRecolher: { color: tema.textoSecundario, fontSize: 11, fontWeight: '700' },

  /**
   * `flex: 35` contra `flex: 65` no mapa. O `minWidth` é o piso onde os
   * cartões da lista ainda cabem sem quebrar: numa janela pequena é melhor
   * comer um pouco do mapa do que entregar uma lista ilegível.
   */
  painel: {
    flex: 35,
    minWidth: 320,
    minHeight: 0,
    borderRightWidth: 1,
    borderRightColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  mapa: { flex: 65, minWidth: 0, minHeight: 0 },
}));

export default CascaPC;
