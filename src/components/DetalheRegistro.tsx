import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContatoProtegido from './ContatoProtegido';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  type Registro,
} from '../data/registros';
import { useArrastarParaFechar } from '../hooks/useArrastarParaFechar';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useMetricas } from '../tema/ThemeContext';

type Props = {
  registro: Registro | null;
  aoFechar: () => void;
  aoEditar?: (registro: Registro) => void;
  aoExcluir?: (registro: Registro) => void;
  aoAlternarFavorito?: (registro: Registro) => void;
};

const simNao = (valor?: boolean): string =>
  valor === true ? 'Sim' : valor === false ? 'Não' : '—';

const DetalheRegistro: React.FC<Props> = ({
  registro,
  aoFechar,
  aoEditar,
  aoExcluir,
  aoAlternarFavorito,
}) => {
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosDetalhe);
  const insets = useSafeAreaInsets();
  const { gesto, estiloArrasto } = useArrastarParaFechar(aoFechar);

  if (!registro) {
    return null;
  }

  const situacao = calcularSituacao(registro);
  const cor = corPorSituacao[situacao];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={aoFechar}>
      {/* O Modal do RN abre numa janela nativa separada, fora da árvore do
          GestureHandlerRootView principal — sem este wrapper próprio, o
          gesto de arrastar a alça fica sem efeito dentro do modal. */}
      <GestureHandlerRootView style={estilos.fundo}>
        <Animated.View style={[estilos.painel, estiloArrasto]}>
          <GestureDetector gesture={gesto}>
            <View style={estilos.areaPuxador}>
              <View style={estilos.puxador} />
            </View>
          </GestureDetector>

          <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
            <View style={estilos.linhaTopo}>
              <View style={[estilos.selo, { backgroundColor: `${cor}22` }]}>
                <Text
                  style={[estilos.textoSelo, { color: cor }]}
                  maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                  {rotuloSituacao[situacao]}
                </Text>
              </View>

              {aoAlternarFavorito ? (
                <Pressable
                  onPress={() => aoAlternarFavorito(registro)}
                  accessibilityRole="button"
                  accessibilityLabel={registro.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  hitSlop={12}>
                  <Text style={estilos.estrela}>{registro.favorito ? '★' : '☆'}</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={estilos.titulo}>{registro.competencia}</Text>

            {/* Em tablet os campos fluem em duas colunas: um painel largo com
                uma coluna só deixaria metade da tela vazia e obrigaria a rolar
                muito mais. As seções ocupam a linha inteira e quebram a grade
                no ponto certo. */}
            <View style={estilos.grade}>
              <Secao titulo="Lotação" />
              <Campo rotulo="Departamento" valor={rotularUnidade(registro.departamentoSigla, registro.departamento)} />
              <Campo
                rotulo="Direção"
                valor={[registro.departamentoCargo, registro.departamentoResponsavel]
                  .filter(Boolean)
                  .join(' ') || '—'}
              />
              <Campo rotulo="Setor" valor={rotularUnidade(registro.setorSigla, registro.setor)} />
              <Campo
                rotulo="Responsável"
                valor={[registro.cargo, registro.responsavel].filter(Boolean).join(' ') || '—'}
              />

              <Secao titulo="Atendimento pelo SIG" />
              <Campo rotulo="O sistema atende?" valor={simNao(registro.sistemaAtende)} />
              {registro.comoAtende ? <Campo rotulo="De que forma" valor={registro.comoAtende} largo /> : null}
              <Campo rotulo="Já estruturado no sistema?" valor={simNao(registro.estruturadoNoSistema)} />
              <Campo rotulo="Houve treinamento?" valor={simNao(registro.houveTreinamento)} />

              <Secao titulo="Camadas" />
              <Campo rotulo="Informações acessadas" valor={registro.informacoesAcessadas || '—'} />
              <Campo rotulo="Nível de acesso" valor={registro.nivelAcessoCamada || '—'} />
              <Campo rotulo="Acesso concedido?" valor={simNao(registro.acessoCamadaConcedido)} />
              <Campo rotulo="Iniciou a atividade?" valor={simNao(registro.iniciouAtividade)} />

              <Secao titulo="Módulo" />
              <Campo rotulo="Módulo do SIG" valor={registro.moduloSig || '—'} />
              <Campo rotulo="Nível de acesso" valor={registro.nivelAcessoModulo || '—'} />
              <Campo rotulo="Acesso concedido?" valor={simNao(registro.acessoModuloConcedido)} />

              <Secao titulo="Problemas" />
              <Campo rotulo="Tem problema no SIG?" valor={simNao(registro.temProblema)} />
              <Campo rotulo="Tem chamado aberto?" valor={simNao(registro.temChamado)} />
              {registro.detalheProblema ? (
                <Campo rotulo="Detalhe" valor={registro.detalheProblema} largo />
              ) : null}
              {registro.observacao ? <Campo rotulo="Observação" valor={registro.observacao} largo /> : null}

              {registro.contatoInstitucional?.email || registro.contatoInstitucional?.telefone ? (
                <>
                  <Secao titulo="Contato institucional" />
                  <View style={estilos.blocoLargo}>
                    {registro.contatoInstitucional.email ? (
                      <Text style={estilos.valor} selectable>
                        {registro.contatoInstitucional.email}
                      </Text>
                    ) : null}
                    {registro.contatoInstitucional.telefone ? (
                      <Text style={estilos.valor} selectable>
                        {registro.contatoInstitucional.telefone}
                      </Text>
                    ) : null}
                    {registro.contatoInstitucional.ramal ? (
                      <Text style={estilos.valor} selectable>
                        Ramal {registro.contatoInstitucional.ramal}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}

              <View style={estilos.blocoLargo}>
                <ContatoProtegido contato={registro.contatoPessoal} />
              </View>
            </View>
          </ScrollView>

          {/* O rodapé respeita a barra de gestos: dentro de um Modal o
              SafeAreaView do App não vale mais, o inset precisa ser aplicado
              aqui. */}
          <View style={[estilos.rodape, { paddingBottom: insets.bottom + 4 }]}>
            {aoExcluir ? (
              <Pressable
                onPress={() => aoExcluir(registro)}
                style={estilos.botaoExcluir}
                accessibilityRole="button"
                accessibilityLabel="Excluir competência">
                <Text style={estilos.textoBotaoExcluir} maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                  Excluir
                </Text>
              </Pressable>
            ) : null}
            {aoEditar ? (
              <Pressable
                onPress={() => aoEditar(registro)}
                style={estilos.botaoEditar}
                accessibilityRole="button"
                accessibilityLabel="Editar competência">
                <Text style={estilos.textoBotaoEditar} maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                  Editar
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={aoFechar} style={estilos.botaoFechar} accessibilityRole="button">
              <Text style={estilos.textoBotaoFechar} maxFontSizeMultiplier={metricas.fonteMaxDensa}>
                Fechar
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const rotularUnidade = (sigla: string, nome: string): string =>
  [sigla, nome].filter(Boolean).join(' — ') || '—';

const Secao: React.FC<{ titulo: string }> = ({ titulo }) => {
  const estilos = useEstilos(criarEstilosDetalhe);
  return <Text style={estilos.secao}>{titulo}</Text>;
};

/** `largo` força o campo a ocupar a linha inteira mesmo no layout de duas colunas. */
const Campo: React.FC<{ rotulo: string; valor: string; largo?: boolean }> = ({
  rotulo,
  valor,
  largo,
}) => {
  const estilos = useEstilos(criarEstilosDetalhe);
  return (
    <View style={[estilos.bloco, largo && estilos.blocoLargo]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor} selectable>
        {valor}
      </Text>
    </View>
  );
};

const criarEstilosDetalhe = criarEstilos((tema, m) => ({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: tema.overlay },
  painel: {
    width: '100%',
    // Em tablet o painel para de ocupar a largura toda e vira uma folha
    // centralizada; no celular continua colado nas bordas.
    maxWidth: m.larguraMaxModal,
    alignSelf: 'center',
    maxHeight: m.alturaMaxModal,
    backgroundColor: tema.fundoElevado,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: m.compacta ? 16 : 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: tema.borda,
  },
  areaPuxador: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  puxador: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: tema.bordaForte,
  },
  conteudo: { paddingBottom: 16 },
  grade: {
    flexDirection: m.expandida ? 'row' : 'column',
    flexWrap: m.expandida ? 'wrap' : 'nowrap',
    columnGap: 20,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selo: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  estrela: {
    fontSize: 24,
    color: tema.favorito,
  },
  textoSelo: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titulo: {
    color: tema.texto,
    fontSize: m.expandida ? 19 : 17,
    fontWeight: '700',
    lineHeight: m.expandida ? 26 : 24,
    marginBottom: 6,
  },
  secao: {
    width: '100%',
    color: tema.primaria,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 20,
    marginBottom: 2,
  },
  bloco: { marginTop: 10, width: m.expandida ? '46%' : '100%', flexGrow: 1 },
  blocoLargo: { width: '100%' },
  rotulo: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  valor: { color: tema.texto, fontSize: 14, lineHeight: 21 },
  rodape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    paddingTop: 4,
  },
  botaoExcluir: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: tema.erroFundo,
  },
  textoBotaoExcluir: { color: tema.erro, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  botaoEditar: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: tema.superficie,
  },
  textoBotaoEditar: { color: tema.texto, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  botaoFechar: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 48,
    backgroundColor: tema.primaria,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotaoFechar: {
    color: tema.textoInvertido,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
}));

export default DetalheRegistro;
