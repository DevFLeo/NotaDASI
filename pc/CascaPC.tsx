import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AjustesTela from '../src/components/AjustesTela';
import ListaAnotacoes from '../src/components/ListaAnotacoes';
import ListaRegistros from '../src/components/ListaRegistros';
import MenuCampos from '../src/components/MenuCampos';
import MapaMental from '../src/mapa/MapaMental';
import Modais from '../src/app/Modais';
import { useAplicacao } from '../src/app/useAplicacao';
import { useSessao } from '../src/auth/useSessao';
import { criarEstilos } from '../src/tema/estilos';
import {
  AreaDeLayout,
  useEstilos,
  useMetricas,
  usePreferenciaTema,
  useTema,
} from '../src/tema/ThemeContext';
import {
  IconeEngrenagem,
  IconeLista,
  IconeLua,
  IconeLupa,
  IconeSol,
  IconeX,
} from '../src/tema/Icones';

type Painel = 'lista' | 'ajustes' | 'campos' | null;

const LARGURA_BARRA = 216;
const LARGURA_BARRA_REDUZIDA = 72;
const LIMITE_BARRA_LARGA = 1180;

const CHAVE_PAINEL = '@notadasi:pc-painel';
const CHAVE_BARRA = '@notadasi:pc-barra-reduzida';
const CHAVE_LARGURA_PAINEL = '@notadasi:pc-largura-painel';

const IconeSeta: React.FC<{ tamanho?: number; cor: string; paraDireita: boolean }> = ({
  tamanho = 16,
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
  const [preferencia, definirPreferencia] = usePreferenciaTema();

  const [painel, setPainel] = useState<Painel>(null);
  const [barraReduzidaSalva, setBarraReduzidaSalva] = useState(false);

  // Largura dinâmica do painel redimensionável no PC (em px)
  const [larguraPainelPx, setLarguraPainelPx] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(340, Math.min(840, Math.round(window.innerWidth * 0.38)));
    }
    return 480;
  });

  const [arrastandoDivisor, setArrastandoDivisor] = useState(false);
  const [areaPainel, setAreaPainel] = useState({ largura: 480, altura: 600 });

  // Busca rápida global de topo no PC (Ctrl+K)
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [buscaFocada, setBuscaFocada] = useState(false);
  const inputBuscaRef = useRef<any>(null);

  // Modal de ajuda de atalhos de teclado no PC
  const [modalAtalhosAberto, setModalAtalhosAberto] = useState(false);

  const medirPainel = useCallback((evento: LayoutChangeEvent) => {
    const { width, height } = evento.nativeEvent.layout;
    setAreaPainel((atual) =>
      Math.abs(atual.largura - width) < 1 && Math.abs(atual.altura - height) < 1
        ? atual
        : { largura: width, altura: height },
    );
  }, []);

  const barraReduzida = barraReduzidaSalva || metricas.largura < LIMITE_BARRA_LARGA;

  useEffect(() => {
    let ativo = true;

    Promise.all([
      AsyncStorage.getItem(CHAVE_PAINEL),
      AsyncStorage.getItem(CHAVE_BARRA),
      AsyncStorage.getItem(CHAVE_LARGURA_PAINEL),
    ]).then(([painelSalvo, barraSalva, larguraSalva]) => {
      if (!ativo) return;
      if (painelSalvo === 'lista' || painelSalvo === 'ajustes' || painelSalvo === 'campos') {
        setPainel(painelSalvo);
      }
      setBarraReduzidaSalva(barraSalva === 'sim');
      if (larguraSalva) {
        const val = parseInt(larguraSalva, 10);
        if (!isNaN(val) && val >= 320 && val <= 1400) {
          setLarguraPainelPx(val);
        }
      }
    });

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

  // Redimensionamento interativo por arrasto do divisor (col-resize)
  const iniciarRedimensionamento = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return;
      e.preventDefault();
      setArrastandoDivisor(true);
      const larguraBarraAtual = barraReduzida ? LARGURA_BARRA_REDUZIDA : LARGURA_BARRA;

      const mover = (ev: MouseEvent) => {
        const novaLargura = ev.clientX - larguraBarraAtual;
        const minL = 320;
        const maxL = Math.round(window.innerWidth * 0.78);
        const clamped = Math.max(minL, Math.min(maxL, novaLargura));
        setLarguraPainelPx(clamped);
      };

      const soltar = () => {
        setArrastandoDivisor(false);
        window.removeEventListener('mousemove', mover);
        window.removeEventListener('mouseup', soltar);
        setLarguraPainelPx((atual) => {
          AsyncStorage.setItem(CHAVE_LARGURA_PAINEL, String(atual)).catch(() => {});
          return atual;
        });
      };

      window.addEventListener('mousemove', mover);
      window.addEventListener('mouseup', soltar);
    },
    [barraReduzida],
  );

  // Atalhos de Teclado Globais no PC (Ctrl+K, Ctrl+B, Ctrl+1, Ctrl+2, Ctrl+N, Esc)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement;
      const emInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputBuscaRef.current?.focus();
        setBuscaFocada(true);
      } else if (mod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        guardarBarra(!barraReduzida);
      } else if (mod && e.key === '1') {
        e.preventDefault();
        acionar('lista');
      } else if (mod && e.key === '2') {
        e.preventDefault();
        acionar('ajustes');
      } else if (mod && e.key === '3') {
        e.preventDefault();
        acionar('campos');
      } else if (mod && (e.key === 'n' || e.key === 'N')) {
        if (!emInput) {
          e.preventDefault();
          app.abrirCriacao();
        }
      } else if (e.key === '?' && !emInput) {
        e.preventDefault();
        setModalAtalhosAberto((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (buscaFocada || buscaGlobal) {
          setBuscaGlobal('');
          setBuscaFocada(false);
        } else if (modalAtalhosAberto) {
          setModalAtalhosAberto(false);
        } else if (painel) {
          guardarPainel(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barraReduzida, guardarBarra, acionar, app, buscaFocada, buscaGlobal, modalAtalhosAberto, painel, guardarPainel]);

  // Resultados da busca global instantânea
  const resultadosBuscaGlobal = useMemo(() => {
    const termo = buscaGlobal.trim().toLowerCase();
    if (!termo) return [];
    return app.registros
      .filter((r) => {
        const texto = `${r.competencia} ${r.departamento} ${r.departamentoSigla} ${r.setor} ${r.setorSigla} ${r.responsavel} ${r.moduloSig}`.toLowerCase();
        return texto.includes(termo);
      })
      .slice(0, 8);
  }, [buscaGlobal, app.registros]);

  const aplicarPredefinicaoLargura = (percentual: number) => {
    if (typeof window !== 'undefined') {
      const nova = Math.round(window.innerWidth * percentual);
      setLarguraPainelPx(nova);
      AsyncStorage.setItem(CHAVE_LARGURA_PAINEL, String(nova)).catch(() => {});
    }
  };

  const alternarTema = () => {
    const proximo = preferencia === 'escuro' ? 'claro' : 'escuro';
    definirPreferencia(proximo);
  };

  const tituloPainel =
    painel === 'lista'
      ? app.campoAtivo.nome
      : painel === 'ajustes'
        ? 'Ajustes & Aceite Excel'
        : painel === 'campos'
          ? 'Gerenciar Campos'
          : '';

  return (
    <View style={estilos.raiz}>
      {/* ─────────────────────────────────────────────────────────────
          BARRA SUPERIOR DO PC (Topo de Alta Produtividade)
          ───────────────────────────────────────────────────────────── */}
      <View style={estilos.topo}>
        {/* Seletor de Campo / Cofre */}
        <Pressable
          onPress={() => acionar('campos')}
          accessibilityRole="button"
          accessibilityLabel={`Campo ativo: ${app.campoAtivo.nome}. Clique para trocar.`}
          style={[estilos.botaoCampo, painel === 'campos' && estilos.botaoCampoAtivo]}>
          <Text style={estilos.rotuloCampo}>Campo</Text>
          <Text style={estilos.nomeCampo} numberOfLines={1}>
            {app.campoAtivo.nome}
          </Text>
          <IconeSeta tamanho={13} cor={tema.textoSecundario} paraDireita={painel !== 'campos'} />
        </Pressable>

        {/* Marca e Subtítulo */}
        <View style={estilos.tituloTopo}>
          <Text style={estilos.marca}>NotaDASI</Text>
          <Text style={estilos.subtitulo} numberOfLines={1}>
            SIG Geo 360 · {app.registros.length} competências
          </Text>
        </View>

        {/* Busca Rápida Global no PC (Ctrl+K) */}
        <View style={estilos.areaBuscaGlobal}>
          <View style={estilos.caixaInputBusca}>
            <IconeLupa tamanho={15} cor={tema.textoTerciario} />
            <TextInput
              ref={inputBuscaRef}
              value={buscaGlobal}
              onChangeText={setBuscaGlobal}
              onFocus={() => setBuscaFocada(true)}
              placeholder="Buscar competência, setor, secretaria... (Ctrl+K)"
              placeholderTextColor={tema.textoTerciario}
              style={estilos.inputBuscaGlobal}
            />
            {buscaGlobal ? (
              <Pressable
                onPress={() => {
                  setBuscaGlobal('');
                  setBuscaFocada(false);
                }}
                style={estilos.botaoLimparBusca}>
                <IconeX tamanho={14} cor={tema.textoTerciario} />
              </Pressable>
            ) : (
              <View style={estilos.badgeAtalhoBusca}>
                <Text style={estilos.textoAtalhoBusca}>Ctrl+K</Text>
              </View>
            )}
          </View>

          {/* Dropdown de Resultados da Busca Global */}
          {buscaFocada && buscaGlobal.trim().length > 0 && (
            <View style={estilos.dropdownResultados}>
              <View style={estilos.cabecalhoDropdown}>
                <Text style={estilos.tituloCabecalhoDropdown}>
                  {resultadosBuscaGlobal.length} correspondências encontradas:
                </Text>
                <Pressable onPress={() => setBuscaFocada(false)}>
                  <Text style={estilos.fecharDropdown}>Fechar [Esc]</Text>
                </Pressable>
              </View>

              <ScrollView style={estilos.scrollResultados} keyboardShouldPersistTaps="handled">
                {resultadosBuscaGlobal.length > 0 ? (
                  resultadosBuscaGlobal.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        app.setSelecionado(r);
                        setBuscaFocada(false);
                        setBuscaGlobal('');
                      }}
                      style={estilos.itemResultadoBusca}>
                      <View style={estilos.linhaResultadoTopo}>
                        <View style={estilos.tagSecSetor}>
                          <Text style={estilos.textoTagSecSetor}>
                            {r.departamentoSigla || 'SEC'} • {r.setorSigla || 'SETOR'}
                          </Text>
                        </View>
                        <Text style={estilos.nomeRespResultado}>{r.responsavel || '—'}</Text>
                      </View>
                      <Text style={estilos.textoCompResultado} numberOfLines={2}>
                        {r.competencia}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <View style={estilos.caixaVaziaBusca}>
                    <Text style={estilos.textoVaziaBusca}>Nenhuma competência encontrada.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Botão de Ação Rápida: + Nova Competência */}
        <Pressable
          onPress={() => app.abrirCriacao()}
          style={estilos.botaoNovaComp}
          accessibilityRole="button"
          accessibilityLabel="Criar nova competência (Ctrl+N)">
          <Text style={estilos.textoBotaoNovaComp}>+ Criar</Text>
        </Pressable>

        {/* Alternância Rápida de Tema (Claro / Escuro) */}
        <Pressable
          onPress={alternarTema}
          style={estilos.botaoTema}
          accessibilityRole="button"
          accessibilityLabel={`Tema atual: ${tema.modo}. Clique para alternar.`}>
          {tema.modo === 'escuro' ? (
            <IconeSol tamanho={17} cor="#f59e0b" />
          ) : (
            <IconeLua tamanho={17} cor={tema.texto} />
          )}
        </Pressable>

        {/* Botão de Ajuda com Atalhos */}
        <Pressable
          onPress={() => setModalAtalhosAberto(true)}
          style={estilos.botaoAtalhos}
          accessibilityRole="button"
          accessibilityLabel="Atalhos de teclado do PC">
          <Text style={estilos.iconeAtalhos}>[ ? ]</Text>
        </Pressable>

        {/* Identificação de Conta */}
        {contaAtual ? (
          <Pressable
            onPress={() => acionar('ajustes')}
            accessibilityRole="button"
            accessibilityLabel={`Conta ${contaAtual.nome}. Clique para abrir os ajustes.`}
            style={estilos.chipConta}>
            <View style={estilos.avatar}>
              <Text style={estilos.inicial}>{contaAtual.nome.slice(0, 1)}</Text>
            </View>
            <View style={estilos.infoConta}>
              <Text style={estilos.nomeConta} numberOfLines={1}>
                {contaAtual.nome}
              </Text>
              <Text style={estilos.papelConta}>{contaAtual.papel.toUpperCase()}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* ─────────────────────────────────────────────────────────────
          CORPO PRINCIPAL (Barra Lateral + Painel Redimensionável + Mapa)
          ───────────────────────────────────────────────────────────── */}
      <View style={estilos.corpo}>
        {/* Barra Lateral com Atalhos */}
        <View
          style={[estilos.barra, { width: barraReduzida ? LARGURA_BARRA_REDUZIDA : LARGURA_BARRA }]}>
          <ItemBarra
            rotulo="Lista"
            Icone={IconeLista}
            ativo={painel === 'lista'}
            reduzida={barraReduzida}
            aoTocar={() => acionar('lista')}
            atalho="Ctrl+1"
          />
          <ItemBarra
            rotulo="Ajustes"
            Icone={IconeEngrenagem}
            ativo={painel === 'ajustes'}
            reduzida={barraReduzida}
            aoTocar={() => acionar('ajustes')}
            atalho="Ctrl+2"
          />

          <View style={estilos.espacador} />

          {metricas.largura >= LIMITE_BARRA_LARGA ? (
            <Pressable
              onPress={() => guardarBarra(!barraReduzida)}
              accessibilityRole="button"
              accessibilityLabel={barraReduzida ? 'Expandir barra (Ctrl+B)' : 'Reduzir barra (Ctrl+B)'}
              style={estilos.botaoRecolher}>
              <IconeSeta tamanho={16} cor={tema.textoSecundario} paraDireita={barraReduzida} />
              {barraReduzida ? null : <Text style={estilos.textoRecolher}>Recolher [Ctrl+B]</Text>}
            </Pressable>
          ) : null}
        </View>

        {/* Painel Redimensionável no PC */}
        {painel ? (
          <View
            style={[
              estilos.painel,
              { width: larguraPainelPx, flex: undefined },
            ]}
            onLayout={medirPainel}>
            {/* Barra de Controles do Painel (Presets de Largura e Fechar) */}
            <View style={estilos.barraTopoPainel}>
              <Text style={estilos.tituloPainel}>{tituloPainel}</Text>

              <View style={estilos.faixaPresetsLargura}>
                <Pressable
                  onPress={() => aplicarPredefinicaoLargura(0.35)}
                  style={estilos.botaoPreset}>
                  <Text style={estilos.textoPreset}>35%</Text>
                </Pressable>
                <Pressable
                  onPress={() => aplicarPredefinicaoLargura(0.5)}
                  style={estilos.botaoPreset}>
                  <Text style={estilos.textoPreset}>50%</Text>
                </Pressable>
                <Pressable
                  onPress={() => aplicarPredefinicaoLargura(0.7)}
                  style={estilos.botaoPreset}>
                  <Text style={estilos.textoPreset}>70%</Text>
                </Pressable>
                <Pressable
                  onPress={fecharPainel}
                  style={estilos.botaoFecharPainel}
                  accessibilityLabel="Fechar painel (Esc)">
                  <IconeX tamanho={14} cor={tema.textoSecundario} />
                </Pressable>
              </View>
            </View>

            <View style={estilos.conteudoPainel}>
              <AreaDeLayout largura={areaPainel.largura} altura={areaPainel.altura - 40}>
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
                ) : painel === 'ajustes' ? (
                  <AjustesTela
                    origem={app.origem}
                    totalRegistros={app.registros.length}
                    registros={app.registros}
                    aoLimparDados={app.limparDadosLocais}
                    campoAtivo={app.campoAtivo}
                    totalCampos={app.campos.length}
                    aoAbrirCampos={() => acionar('campos')}
                    aceiteExcel={app.aceiteExcel}
                    nomePlanilhaAtiva={app.nomePlanilhaAtiva}
                    aoSalvarAceiteExcel={app.salvarAceiteExcel}
                    aoReverterAceiteExcel={app.reverterAceiteExcel}
                    aoCarregarBasePlanilha={app.carregarBasePlanilha}
                    aoRestaurarBasePadrao={app.restaurarBasePadrao}
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
          </View>
        ) : null}

        {/* Divisor Arrastável (Split Handle) entre Painel e Mapa */}
        {painel ? (
          <View
            {...(Platform.OS === 'web'
              ? {
                  onMouseDown: iniciarRedimensionamento,
                  onDoubleClick: () => aplicarPredefinicaoLargura(0.38),
                  title: 'Arraste para redimensionar · Duplo clique para restaurar 38%',
                  style: [estilos.divisorRedimensionavel, arrastandoDivisor && estilos.divisorAtivo],
                }
              : { style: estilos.divisorRedimensionavel })}>
            <View style={estilos.puxadorDivisor}>
              <Text style={estilos.iconeDivisor}>⋮</Text>
            </View>
          </View>
        ) : null}

        {/* Mapa Mental em Foco à Direita */}
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

      {/* Modal de Atalhos de Teclado no PC */}
      <Modal visible={modalAtalhosAberto} transparent animationType="fade">
        <View style={estilos.fundoModal}>
          <View style={estilos.janelaModalAtalhos}>
            <View style={estilos.topoModalAtalhos}>
              <View style={estilos.linhaTituloModalAtalhos}>
                <Text style={estilos.tituloModalAtalhos}>Atalhos de Teclado (PC)</Text>
              </View>
              <Pressable
                onPress={() => setModalAtalhosAberto(false)}
                style={estilos.botaoFecharModalAtalhos}>
                <IconeX tamanho={16} cor={tema.textoSecundario} />
              </Pressable>
            </View>

            <ScrollView style={estilos.corpoModalAtalhos}>
              <View style={estilos.gridAtalhos}>
                <LinhaAtalho tecla="Ctrl + K" descricao="Abrir busca rápida global" />
                <LinhaAtalho tecla="Ctrl + B" descricao="Recolher / expandir barra lateral" />
                <LinhaAtalho tecla="Ctrl + 1" descricao="Abrir / fechar painel de Lista" />
                <LinhaAtalho tecla="Ctrl + 2" descricao="Abrir / fechar painel de Ajustes & Excel" />
                <LinhaAtalho tecla="Ctrl + 3" descricao="Gerenciar campos e cofres" />
                <LinhaAtalho tecla="Ctrl + N" descricao="Criar nova competência" />
                <LinhaAtalho tecla="Esc" descricao="Fechar modais, busca ou painel lateral" />
                <LinhaAtalho tecla="Roda do Mouse" descricao="Zoom no mapa mental (foco no cursor)" />
                <LinhaAtalho tecla="+ / −" descricao="Aumentar / diminuir zoom do mapa" />
                <LinhaAtalho tecla="0" descricao="Centralizar mapa mental" />
                <LinhaAtalho tecla="F" descricao="Ajustar todos os nós à tela" />
                <LinhaAtalho tecla="Ctrl + S" descricao="Salvar formulário instantaneamente" />
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setModalAtalhosAberto(false)}
              style={estilos.botaoEntendidoModal}>
              <Text style={estilos.textoBotaoEntendido}>Entendido [Esc]</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modais app={app} ocultarMenuCampos />
    </View>
  );
};

const LinhaAtalho: React.FC<{ tecla: string; descricao: string }> = ({ tecla, descricao }) => {
  const tema = useTema();
  const estilos = useEstilos(criarEstilosPC);
  return (
    <View style={estilos.linhaAtalhoItem}>
      <View style={estilos.badgeTecla}>
        <Text style={estilos.textoTecla}>{tecla}</Text>
      </View>
      <Text style={estilos.descricaoAtalho}>{descricao}</Text>
    </View>
  );
};

const ItemBarra: React.FC<{
  rotulo: string;
  Icone: React.FC<{ tamanho?: number; cor: string }>;
  ativo: boolean;
  reduzida: boolean;
  aoTocar: () => void;
  atalho?: string;
}> = ({ rotulo, Icone, ativo, reduzida, aoTocar, atalho }) => {
  const tema = useTema();
  const estilos = useEstilos(criarEstilosPC);
  const cor = ativo ? tema.primariaTexto : tema.textoSecundario;

  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={rotulo}
      accessibilityHint={atalho ? `Atalho: ${atalho}` : undefined}
      {...(Platform.OS === 'web' && atalho ? { title: `${rotulo} [${atalho}]` } : {})}
      style={[estilos.item, reduzida && estilos.itemReduzido, ativo && estilos.itemAtivo]}>
      <Icone tamanho={20} cor={cor} />
      {reduzida ? null : (
        <View style={estilos.rotuloItemBarraContainer}>
          <Text style={[estilos.textoItem, ativo && estilos.textoItemAtivo]} numberOfLines={1}>
            {rotulo}
          </Text>
          {atalho ? <Text style={estilos.atalhoItemBarra}>{atalho}</Text> : null}
        </View>
      )}
    </Pressable>
  );
};

const criarEstilosPC = criarEstilos((tema) => ({
  raiz: { flex: 1, backgroundColor: tema.fundo },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
    backgroundColor: tema.fundoElevado,
    zIndex: 100,
  },
  botaoCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  botaoCampoAtivo: { borderColor: tema.primaria, backgroundColor: tema.primariaFundo },
  rotuloCampo: {
    color: tema.textoTerciario,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nomeCampo: { color: tema.texto, fontSize: 12, fontWeight: '700', flexShrink: 1 },

  tituloTopo: { minWidth: 130 },
  marca: {
    color: tema.primariaTexto,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitulo: { color: tema.textoSecundario, fontSize: 11, marginTop: 1 },

  // Busca rápida global no topo
  areaBuscaGlobal: {
    flex: 1,
    maxWidth: 480,
    position: 'relative',
    marginHorizontal: 8,
  },
  caixaInputBusca: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tema.superficie,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.borda,
    paddingHorizontal: 10,
    height: 34,
  },
  inputBuscaGlobal: {
    flex: 1,
    color: tema.texto,
    fontSize: 12,
    marginLeft: 8,
    paddingVertical: 0,
    height: 34,
  },
  badgeAtalhoBusca: {
    backgroundColor: tema.fundoElevado,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  textoAtalhoBusca: {
    fontSize: 10,
    fontWeight: '700',
    color: tema.textoTerciario,
  },
  botaoLimparBusca: {
    padding: 4,
  },
  dropdownResultados: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: tema.fundoElevado,
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 380,
    zIndex: 999,
  },
  cabecalhoDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
  },
  tituloCabecalhoDropdown: { fontSize: 11, fontWeight: '700', color: tema.textoSecundario },
  fecharDropdown: { fontSize: 11, fontWeight: '600', color: tema.textoTerciario },
  scrollResultados: { maxHeight: 320 },
  itemResultadoBusca: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
  },
  linhaResultadoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagSecSetor: {
    backgroundColor: tema.primariaFundo,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  textoTagSecSetor: {
    fontSize: 10,
    fontWeight: '800',
    color: tema.primaria,
  },
  nomeRespResultado: { fontSize: 11, color: tema.textoTerciario },
  textoCompResultado: { fontSize: 12, color: tema.texto, lineHeight: 17 },
  caixaVaziaBusca: { padding: 16, alignItems: 'center' },
  textoVaziaBusca: { fontSize: 12, color: tema.textoTerciario, fontStyle: 'italic' },

  // Botão Criar no Topo
  botaoNovaComp: {
    backgroundColor: tema.primaria,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  textoBotaoNovaComp: {
    color: tema.textoInvertido,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Botões de Ferramentas
  botaoTema: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoAtalhos: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAtalhos: { fontSize: 15 },

  // Conta
  chipConta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.primariaFundo,
  },
  inicial: { color: tema.primariaTexto, fontSize: 12, fontWeight: '800' },
  infoConta: { flexShrink: 1 },
  nomeConta: { color: tema.texto, fontSize: 11, fontWeight: '700' },
  papelConta: { color: tema.primaria, fontSize: 8, fontWeight: '800' },

  corpo: { flex: 1, flexDirection: 'row', minHeight: 0 },

  barra: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: tema.superficie,
  },
  itemReduzido: { justifyContent: 'center', paddingHorizontal: 0 },
  itemAtivo: { backgroundColor: tema.primariaFundo },
  rotuloItemBarraContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textoItem: {
    color: tema.textoSecundario,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textoItemAtivo: { color: tema.primariaTexto },
  atalhoItemBarra: { fontSize: 9, color: tema.textoTerciario, fontWeight: '600' },
  espacador: { flex: 1 },
  botaoRecolher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: tema.superficie,
  },
  textoRecolher: { color: tema.textoSecundario, fontSize: 10, fontWeight: '700' },

  // Painel Redimensionável
  painel: {
    minWidth: 320,
    maxWidth: '80%',
    minHeight: 0,
    backgroundColor: tema.fundoElevado,
  },
  barraTopoPainel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
    backgroundColor: tema.fundoElevado,
  },
  tituloPainel: {
    fontSize: 12,
    fontWeight: '800',
    color: tema.texto,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faixaPresetsLargura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  botaoPreset: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  textoPreset: {
    fontSize: 10,
    fontWeight: '700',
    color: tema.textoSecundario,
  },
  botaoFecharPainel: {
    padding: 5,
    marginLeft: 4,
  },
  conteudoPainel: {
    flex: 1,
  },

  // Divisor Redimensionável (Split Handle)
  divisorRedimensionavel: {
    width: 9,
    backgroundColor: tema.borda,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    cursor: (Platform.OS === 'web' ? 'col-resize' : undefined) as any,
  },
  divisorAtivo: {
    backgroundColor: tema.primaria,
  },
  puxadorDivisor: {
    width: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeDivisor: {
    fontSize: 14,
    color: tema.textoTerciario,
    userSelect: 'none' as any,
  },

  mapa: { flex: 1, minWidth: 0, minHeight: 0 },

  // Modal de Atalhos
  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  janelaModalAtalhos: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: tema.fundoElevado,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tema.borda,
    padding: 20,
  },
  topoModalAtalhos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  linhaTituloModalAtalhos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconeModalAtalhos: { fontSize: 20 },
  tituloModalAtalhos: { fontSize: 16, fontWeight: '800', color: tema.texto },
  botaoFecharModalAtalhos: { padding: 4 },
  corpoModalAtalhos: { maxHeight: 420 },
  gridAtalhos: { gap: 10 },
  linhaAtalhoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
  },
  badgeTecla: {
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  textoTecla: { fontSize: 11, fontWeight: '800', color: tema.primariaTexto, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  descricaoAtalho: { fontSize: 12, color: tema.textoSecundario, flex: 1, marginLeft: 14 },
  botaoEntendidoModal: {
    backgroundColor: tema.primaria,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  textoBotaoEntendido: { color: tema.textoInvertido, fontSize: 12, fontWeight: '700' },
}));

export default CascaPC;
