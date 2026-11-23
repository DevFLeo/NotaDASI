import React, { useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ContatoIntegrado } from '../data/contatosIntegrados';
import type { Registro } from '../data/registros';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import ContatoProtegido from './ContatoProtegido';

type Props = {
  contato: ContatoIntegrado | null;
  aoFechar: () => void;
  aoAbrirRegistroSig?: (registro: Registro) => void;
};

const extrairDigitosTelefone = (telefone: string): string => telefone.replace(/[^\d+]/g, '');

const copiarTextoSilencioso = (texto: string) => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(texto).catch(() => {});
  } else {
    Clipboard.setString(texto);
  }
};

const DetalheContato: React.FC<Props> = ({ contato, aoFechar, aoAbrirRegistroSig }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useMemo(() => criarEstilos(tema, metricas.expandida), [tema, metricas.expandida]);
  const [copiadoCampo, setCopiadoCampo] = useState<string | null>(null);

  useEffect(() => {
    setCopiadoCampo(null);
  }, [contato?.id]);

  if (!contato) return null;

  const copiarComFeedback = (valor: string, chave: string) => {
    copiarTextoSilencioso(valor);
    setCopiadoCampo(chave);
    setTimeout(() => {
      setCopiadoCampo((atual) => (atual === chave ? null : atual));
    }, 1800);
  };

  const abrirDiscador = (telefone: string) => {
    const numeroLimpo = extrairDigitosTelefone(telefone);
    if (!numeroLimpo) return;
    Linking.openURL(`tel:${numeroLimpo}`).catch(() => {});
  };

  const abrirEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  return (
    <Modal
      visible
      transparent
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
      onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={aoFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar detalhes do contato"
        />

        <View style={estilos.painel}>
          {/* Cabeçalho */}
          <View style={estilos.cabecalho}>
            <View style={estilos.linhaBadges}>
              <View
                style={[
                  estilos.badgeOrigem,
                  contato.origem === 'sig' ? estilos.badgeSig : estilos.badgeManual,
                ]}>
                <Text
                  style={[
                    estilos.textoBadgeOrigem,
                    contato.origem === 'sig' ? estilos.textoBadgeSig : estilos.textoBadgeManual,
                  ]}>
                  {contato.origem === 'sig' ? 'INTEGRADO SIG' : 'CONTATO MANUAL'}
                </Text>
              </View>
              <Text style={estilos.subtituloTopo} numberOfLines={1}>
                {contato.secretaria}
                {contato.setorSigla ? ` · ${contato.setorSigla}` : ''}
              </Text>
            </View>

            <Pressable
              onPress={aoFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={estilos.botaoFecharTopo}>
              <Text style={estilos.textoFecharTopo}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={estilos.scroll} contentContainerStyle={estilos.conteudo}>
            {/* Identificação */}
            <View style={estilos.blocoIdentificacao}>
              <Text style={estilos.nome}>{contato.nome}</Text>
              {contato.cargo ? <Text style={estilos.cargo}>{contato.cargo}</Text> : null}
            </View>

            {/* Lotação */}
            <View style={estilos.cardSecao}>
              <Text style={estilos.tituloSecao}>LOTAÇÃO</Text>
              <Text style={estilos.rotuloCampo}>Secretaria / Departamento</Text>
              <Text style={estilos.valorCampo}>
                {contato.secretaria}
                {contato.departamento && contato.departamento !== contato.secretaria
                  ? ` — ${contato.departamento}`
                  : ''}
              </Text>

              <Text style={[estilos.rotuloCampo, { marginTop: 10 }]}>Setor / Divisão</Text>
              <Text style={estilos.valorCampo}>
                {contato.setorSigla ? `${contato.setorSigla} — ` : ''}
                {contato.setor}
              </Text>
            </View>

            {/* Canais de Contato com Cópia em 1 Clique e Redirecionamento ao Telefone */}
            <View style={estilos.cardSecao}>
              <Text style={estilos.tituloSecao}>CANAIS DE CONTATO</Text>

              {contato.telefone ? (
                <View style={estilos.linhaCanal}>
                  <Pressable
                    onPress={() => copiarComFeedback(contato.telefone!, 'telefone')}
                    accessibilityRole="button"
                    accessibilityLabel={`Copiar telefone ${contato.telefone}`}
                    style={estilos.areaCopiarCanal}>
                    <Text style={estilos.rotuloCampo}>TELEFONE (CLIQUE PARA COPIAR)</Text>
                    <Text style={estilos.valorDestaque}>{contato.telefone}</Text>
                    {copiadoCampo === 'telefone' ? (
                      <Text style={estilos.feedbackCopiado}>Copiado para a área de transferência</Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => abrirDiscador(contato.telefone!)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ligar para ${contato.telefone}`}
                    style={estilos.botaoLigar}>
                    <Text style={estilos.textoBotaoLigar}>Ligar</Text>
                  </Pressable>
                </View>
              ) : null}

              {contato.ramal ? (
                <Pressable
                  onPress={() => copiarComFeedback(contato.ramal!, 'ramal')}
                  accessibilityRole="button"
                  style={estilos.linhaCanal}>
                  <View style={estilos.areaCopiarCanal}>
                    <Text style={estilos.rotuloCampo}>RAMAL (CLIQUE PARA COPIAR)</Text>
                    <Text style={estilos.valorDestaque}>{contato.ramal}</Text>
                    {copiadoCampo === 'ramal' ? (
                      <Text style={estilos.feedbackCopiado}>Ramal copiado</Text>
                    ) : null}
                  </View>
                </Pressable>
              ) : null}

              {contato.email ? (
                <View style={estilos.linhaCanal}>
                  <Pressable
                    onPress={() => copiarComFeedback(contato.email!, 'email')}
                    accessibilityRole="button"
                    accessibilityLabel={`Copiar e-mail ${contato.email}`}
                    style={estilos.areaCopiarCanal}>
                    <Text style={estilos.rotuloCampo}>E-MAIL (CLIQUE PARA COPIAR)</Text>
                    <Text style={estilos.valorCampo}>{contato.email}</Text>
                    {copiadoCampo === 'email' ? (
                      <Text style={estilos.feedbackCopiado}>E-mail copiado</Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => abrirEmail(contato.email!)}
                    accessibilityRole="button"
                    accessibilityLabel={`Enviar e-mail para ${contato.email}`}
                    style={estilos.botaoSecundarioCanal}>
                    <Text style={estilos.textoBotaoSecundarioCanal}>E-mail</Text>
                  </Pressable>
                </View>
              ) : null}

              {contato.semContato ? (
                <Text style={estilos.semCanal}>
                  Nenhum telefone, ramal ou e-mail institucional cadastrado para este contato.
                </Text>
              ) : null}

              {contato.contatoPessoal ? <ContatoProtegido contato={contato.contatoPessoal} /> : null}
            </View>

            {contato.observacao ? (
              <View style={estilos.cardSecao}>
                <Text style={estilos.tituloSecao}>OBSERVAÇÃO</Text>
                <Text style={estilos.valorCampo}>{contato.observacao}</Text>
              </View>
            ) : null}

            {/* Competências vinculadas no SIG */}
            {contato.competenciasVinculadas.length > 0 ? (
              <View style={estilos.cardSecao}>
                <Text style={estilos.tituloSecao}>
                  COMPETÊNCIAS VINCULADAS NO SIG ({contato.competenciasVinculadas.length})
                </Text>
                <View style={estilos.listaComp}>
                  {contato.competenciasVinculadas.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        aoFechar();
                        aoAbrirRegistroSig?.(item.registro);
                      }}
                      style={estilos.itemComp}
                      accessibilityRole="button">
                      <Text style={estilos.textoItemComp} numberOfLines={2}>
                        {item.competencia}
                      </Text>
                      <Text style={estilos.linkAbrir}>Abrir ›</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Rodapé */}
          <View style={estilos.rodape}>
            <Pressable onPress={aoFechar} style={estilos.botaoFecharRodape} accessibilityRole="button">
              <Text style={estilos.textoFecharRodape}>
                {metricas.expandida ? 'FECHAR [Esc]' : 'FECHAR'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const criarEstilos = (tema: Tema, ePC: boolean) =>
  StyleSheet.create({
    fundo: {
      flex: 1,
      backgroundColor: tema.overlay,
      justifyContent: ePC ? 'center' : 'flex-end',
      alignItems: 'center',
      padding: ePC ? 24 : 0,
    },
    painel: {
      width: '100%',
      maxWidth: ePC ? 560 : undefined,
      maxHeight: ePC ? '86%' : '90%',
      backgroundColor: tema.fundo,
      borderRadius: ePC ? 20 : 22,
      borderBottomLeftRadius: ePC ? 20 : 0,
      borderBottomRightRadius: ePC ? 20 : 0,
      borderWidth: 1,
      borderColor: tema.borda,
      overflow: 'hidden',
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: tema.fundoElevado,
      borderBottomWidth: 1,
      borderBottomColor: tema.borda,
      gap: 10,
    },
    linhaBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    badgeOrigem: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeSig: { backgroundColor: tema.primariaFundo },
    badgeManual: { backgroundColor: tema.sucessoFundo },
    textoBadgeOrigem: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
    textoBadgeSig: { color: tema.primariaTexto },
    textoBadgeManual: { color: tema.sucesso },
    subtituloTopo: { fontSize: 12, fontWeight: '700', color: tema.textoTerciario, flexShrink: 1 },
    botaoFecharTopo: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoFecharTopo: { fontSize: 13, fontWeight: '700', color: tema.texto },
    scroll: { flexGrow: 0 },
    conteudo: { padding: 18, gap: 12 },
    blocoIdentificacao: { marginBottom: 4 },
    nome: { fontSize: 20, fontWeight: '800', color: tema.texto },
    cargo: { fontSize: 13, fontWeight: '600', color: tema.textoSecundario, marginTop: 2 },
    cardSecao: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    tituloSecao: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.primaria,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    rotuloCampo: {
      fontSize: 10,
      fontWeight: '700',
      color: tema.textoTerciario,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    valorCampo: { fontSize: 13, fontWeight: '600', color: tema.texto, marginTop: 2 },
    valorDestaque: { fontSize: 16, fontWeight: '800', color: tema.texto, marginTop: 2 },
    linhaCanal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      marginTop: 8,
    },
    areaCopiarCanal: { flex: 1 },
    feedbackCopiado: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.sucesso,
      marginTop: 3,
    },
    botaoLigar: {
      minHeight: 40,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 9,
      backgroundColor: tema.primaria,
    },
    textoBotaoLigar: { fontSize: 12, fontWeight: '800', color: tema.textoInvertido },
    botaoSecundarioCanal: {
      minHeight: 40,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 9,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoSecundarioCanal: { fontSize: 12, fontWeight: '700', color: tema.texto },
    semCanal: { fontSize: 12, color: tema.textoSecundario, fontStyle: 'italic' },
    listaComp: { gap: 6 },
    itemComp: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoItemComp: { flex: 1, fontSize: 12, color: tema.textoSecundario, lineHeight: 16 },
    linkAbrir: { fontSize: 11, fontWeight: '700', color: tema.primaria },
    rodape: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
      backgroundColor: tema.fundoElevado,
    },
    botaoFecharRodape: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoFecharRodape: { fontSize: 12, fontWeight: '800', color: tema.texto },
  });

export default DetalheContato;
