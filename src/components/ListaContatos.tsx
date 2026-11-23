import React, { useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Registro } from '../data/registros';
import {
  textoPesquisavelContato,
  type ContatoIntegrado,
  type NovoContatoManual,
} from '../data/contatosIntegrados';
import { useMetricas, useTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import BarraBusca from './BarraBusca';
import ContatoProtegido from './ContatoProtegido';

type Props = {
  contatos: ContatoIntegrado[];
  totalDoSig: number;
  totalManuais: number;
  totalSemContato: number;
  aoAbrirContato?: (contato: ContatoIntegrado) => void;
  aoAbrirRegistroSig?: (registro: Registro) => void;
  aoAtualizarContatoSig: (
    registroIds: string[],
    dados: {
      nome?: string;
      cargo?: string;
      email?: string;
      telefone?: string;
      ramal?: string;
    },
  ) => void;
  aoCriarContatoManual: (dados: NovoContatoManual) => void;
  aoAtualizarContatoManual: (id: string, dados: NovoContatoManual) => void;
  aoExcluirContatoManual: (id: string) => void;
};

type FiltroOrigem = 'todos' | 'sig' | 'manual' | 'sem_contato';

const extrairDigitosTelefone = (telefone: string): string => telefone.replace(/[^\d+]/g, '');

const copiarSilencioso = (valor: string) => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(valor).catch(() => {});
  } else {
    Clipboard.setString(valor);
  }
};

const ListaContatos: React.FC<Props> = ({
  contatos,
  totalDoSig,
  totalManuais,
  totalSemContato,
  aoAbrirContato,
  aoAbrirRegistroSig,
  aoAtualizarContatoSig,
  aoCriarContatoManual,
  aoAtualizarContatoManual,
  aoExcluirContatoManual,
}) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useMemo(() => criarEstilos(tema, metricas.compacta), [tema, metricas.compacta]);

  const [termoBusca, setTermoBusca] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todos');
  const [secretariaFiltro, setSecretariaFiltro] = useState<string | null>(null);
  const [expandidosId, setExpandidosId] = useState<Record<string, boolean>>({});
  const [copiadoChave, setCopiadoChave] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<
    { modo: 'criar' } | { modo: 'editar'; contato: ContatoIntegrado } | null
  >(null);

  const copiarComFeedback = (valor: string, chave: string) => {
    copiarSilencioso(valor);
    setCopiadoChave(chave);
    setTimeout(() => {
      setCopiadoChave((atual) => (atual === chave ? null : atual));
    }, 1800);
  };

  const secretarias = useMemo(() => {
    const set = new Set<string>();
    contatos.forEach((c) => {
      if (c.secretaria) set.add(c.secretaria);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [contatos]);

  const visiveis = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    return contatos.filter((c) => {
      if (filtroOrigem === 'sig' && c.origem !== 'sig') return false;
      if (filtroOrigem === 'manual' && c.origem !== 'manual') return false;
      if (filtroOrigem === 'sem_contato' && !c.semContato) return false;
      if (secretariaFiltro && c.secretaria !== secretariaFiltro) return false;
      if (termo && !textoPesquisavelContato(c).includes(termo)) return false;
      return true;
    });
  }, [contatos, filtroOrigem, secretariaFiltro, termoBusca]);

  const alternarCompetencias = (id: string) => {
    setExpandidosId((atual) => ({ ...atual, [id]: !atual[id] }));
  };

  const confirmarExclusao = (contato: ContatoIntegrado) => {
    Alert.alert(
      'Excluir contato',
      `Deseja remover o contato manual "${contato.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => aoExcluirContatoManual(contato.id),
        },
      ],
    );
  };

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <Text style={estilos.titulo}>Contatos Institucionais</Text>
      <Text style={estilos.subtitulo}>
        Integrado automaticamente aos registros e planilhas do SIG · {visiveis.length} de{' '}
        {contatos.length} contatos
      </Text>

      {/* Resumo compacto */}
      <View style={estilos.gradeMetricas}>
        <Pressable
          onPress={() => setFiltroOrigem('todos')}
          style={[estilos.cardMetrica, filtroOrigem === 'todos' && estilos.cardMetricaAtivo]}>
          <Text style={estilos.valorMetrica}>{contatos.length}</Text>
          <Text style={estilos.rotuloMetrica}>Total</Text>
        </Pressable>
        <Pressable
          onPress={() => setFiltroOrigem('sig')}
          style={[estilos.cardMetrica, filtroOrigem === 'sig' && estilos.cardMetricaAtivo]}>
          <Text style={[estilos.valorMetrica, { color: tema.primaria }]}>{totalDoSig}</Text>
          <Text style={estilos.rotuloMetrica}>Do SIG</Text>
        </Pressable>
        <Pressable
          onPress={() => setFiltroOrigem('manual')}
          style={[estilos.cardMetrica, filtroOrigem === 'manual' && estilos.cardMetricaAtivo]}>
          <Text style={[estilos.valorMetrica, { color: tema.sucesso }]}>{totalManuais}</Text>
          <Text style={estilos.rotuloMetrica}>Manuais</Text>
        </Pressable>
        <Pressable
          onPress={() => setFiltroOrigem('sem_contato')}
          style={[estilos.cardMetrica, filtroOrigem === 'sem_contato' && estilos.cardMetricaAtivo]}>
          <Text
            style={[
              estilos.valorMetrica,
              { color: totalSemContato > 0 ? tema.alerta : tema.sucesso },
            ]}>
            {totalSemContato}
          </Text>
          <Text style={estilos.rotuloMetrica}>Sem contato</Text>
        </Pressable>
      </View>

      <BarraBusca
        valor={termoBusca}
        aoAlterar={setTermoBusca}
        aoPesquisar={() => {}}
        placeholder="Buscar nome, secretaria, setor, e-mail, telefone ou ramal..."
      />

      {/* Filtro por Secretaria */}
      {secretarias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={estilos.rolagemFiltros}
          contentContainerStyle={estilos.faixaFiltros}>
          <Pressable
            onPress={() => setSecretariaFiltro(null)}
            style={[estilos.chip, secretariaFiltro === null && estilos.chipAtivo]}>
            <Text style={[estilos.textoChip, secretariaFiltro === null && estilos.textoChipAtivo]}>
              Todas ({contatos.length})
            </Text>
          </Pressable>
          {secretarias.map((sec) => {
            const ativo = secretariaFiltro === sec;
            return (
              <Pressable
                key={sec}
                onPress={() => setSecretariaFiltro(ativo ? null : sec)}
                style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <Text style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}>{sec}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderizarItem = ({ item }: { item: ContatoIntegrado }) => {
    const expandido = Boolean(expandidosId[item.id]);
    const totalComp = item.competenciasVinculadas.length;

    return (
      <View style={[estilos.cartao, item.semContato && estilos.cartaoSemContato]}>
        <View style={estilos.topoCartao}>
          <View style={estilos.infoPrincipal}>
            <View style={estilos.linhaBadges}>
              <View
                style={[
                  estilos.badgeOrigem,
                  item.origem === 'sig' ? estilos.badgeSig : estilos.badgeManual,
                ]}>
                <Text
                  style={[
                    estilos.textoBadgeOrigem,
                    item.origem === 'sig' ? estilos.textoBadgeSig : estilos.textoBadgeManual,
                  ]}>
                  {item.origem === 'sig' ? 'INTEGRADO SIG' : 'MANUAL'}
                </Text>
              </View>
              <View style={estilos.badgeSecretaria}>
                <Text style={estilos.textoBadgeSecretaria} numberOfLines={1}>
                  {item.secretaria}
                  {item.setorSigla ? ` · ${item.setorSigla}` : ''}
                </Text>
              </View>
              {item.semContato ? (
                <View style={estilos.badgeAlerta}>
                  <Text style={estilos.textoBadgeAlerta}>Sem contato</Text>
                </View>
              ) : null}
            </View>

            <Pressable onPress={() => aoAbrirContato?.(item)}>
              <Text style={estilos.nomeContato}>{item.nome}</Text>
              <Text style={estilos.subtituloContato} numberOfLines={2}>
                {[item.cargo, item.setor].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          </View>

          <View style={estilos.acoesCartao}>
            <Pressable
              onPress={() => setEmEdicao({ modo: 'editar', contato: item })}
              accessibilityRole="button"
              accessibilityLabel={`Editar contato de ${item.nome}`}
              style={estilos.botaoEditar}>
              <Text style={estilos.textoBotaoEditar}>Editar</Text>
            </Pressable>
            {item.origem === 'manual' ? (
              <Pressable
                onPress={() => confirmarExclusao(item)}
                accessibilityRole="button"
                accessibilityLabel={`Excluir contato ${item.nome}`}
                style={estilos.botaoExcluir}>
                <Text style={estilos.textoBotaoExcluir}>Excluir</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Canais Institucionais: clique no número copia; botão Ligar redireciona para o telefone */}
        <View style={estilos.faixaCanais}>
          {item.telefone ? (
            <View style={estilos.grupoTelefone}>
              <Pressable
                onPress={() => copiarComFeedback(item.telefone!, `${item.id}-tel`)}
                accessibilityRole="button"
                accessibilityLabel={`Copiar telefone ${item.telefone}`}
                style={estilos.pillCanal}>
                <Text style={estilos.rotuloCanal}>
                  {copiadoChave === `${item.id}-tel` ? 'TELEFONE · COPIADO' : 'TELEFONE · COPIAR'}
                </Text>
                <Text style={estilos.valorCanal}>{item.telefone}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const num = extrairDigitosTelefone(item.telefone!);
                  if (num) Linking.openURL(`tel:${num}`).catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityLabel={`Ligar para ${item.telefone}`}
                style={estilos.botaoLigarPill}>
                <Text style={estilos.textoBotaoLigarPill}>Ligar</Text>
              </Pressable>
            </View>
          ) : null}

          {item.ramal ? (
            <Pressable
              onPress={() => copiarComFeedback(item.ramal!, `${item.id}-ramal`)}
              accessibilityRole="button"
              style={estilos.pillCanal}>
              <Text style={estilos.rotuloCanal}>
                {copiadoChave === `${item.id}-ramal` ? 'RAMAL · COPIADO' : 'RAMAL · COPIAR'}
              </Text>
              <Text style={estilos.valorCanal}>{item.ramal}</Text>
            </Pressable>
          ) : null}

          {item.email ? (
            <Pressable
              onPress={() => copiarComFeedback(item.email!, `${item.id}-email`)}
              onLongPress={() => Linking.openURL(`mailto:${item.email}`).catch(() => {})}
              accessibilityRole="button"
              style={estilos.pillCanal}>
              <Text style={estilos.rotuloCanal}>
                {copiadoChave === `${item.id}-email` ? 'E-MAIL · COPIADO' : 'E-MAIL · COPIAR'}
              </Text>
              <Text style={estilos.valorCanal} numberOfLines={1}>
                {item.email}
              </Text>
            </Pressable>
          ) : null}

          {item.semContato ? (
            <Pressable
              onPress={() => setEmEdicao({ modo: 'editar', contato: item })}
              style={estilos.avisoPreencher}>
              <Text style={estilos.textoAvisoPreencher}>
                Nenhum canal institucional cadastrado — toque em Editar para informar e sincronizar com o SIG.
              </Text>
            </Pressable>
          ) : null}
        </View>

        {item.observacao ? (
          <Text style={estilos.observacao}>{item.observacao}</Text>
        ) : null}

        {item.contatoPessoal ? <ContatoProtegido contato={item.contatoPessoal} /> : null}

        {/* Vínculo direto com competências do SIG */}
        {totalComp > 0 ? (
          <View style={estilos.blocoVinculos}>
            <Pressable
              onPress={() => alternarCompetencias(item.id)}
              style={estilos.botaoVinculos}
              accessibilityRole="button">
              <Text style={estilos.textoBotaoVinculos}>
                {totalComp} competência{totalComp === 1 ? '' : 's'} vinculada
                {totalComp === 1 ? '' : 's'} no SIG {expandido ? '▲' : '▼'}
              </Text>
            </Pressable>

            {expandido ? (
              <View style={estilos.listaVinculos}>
                {item.competenciasVinculadas.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => aoAbrirRegistroSig?.(v.registro)}
                    style={estilos.itemVinculo}
                    accessibilityRole="button">
                    <Text style={estilos.textoItemVinculo} numberOfLines={2}>
                      {v.competencia}
                    </Text>
                    <Text style={estilos.abrirVinculo}>Abrir ›</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={estilos.container}>
      <FlatList
        data={visiveis}
        keyExtractor={(item) => item.id}
        renderItem={renderizarItem}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.tituloVazio}>Nenhum contato encontrado</Text>
            <Text style={estilos.textoVazio}>
              Ajuste os filtros ou toque no botão "+" para cadastrar um novo contato institucional.
            </Text>
          </View>
        }
        contentContainerStyle={estilos.listaConteudo}
        keyboardShouldPersistTaps="handled"
      />

      <Pressable
        onPress={() => setEmEdicao({ modo: 'criar' })}
        style={estilos.fab}
        accessibilityRole="button"
        accessibilityLabel="Adicionar novo contato">
        <Text style={estilos.textoFab}>+</Text>
      </Pressable>

      <ModalContato
        edicao={emEdicao}
        aoCancelar={() => setEmEdicao(null)}
        aoSalvar={(dados) => {
          if (emEdicao?.modo === 'editar') {
            if (emEdicao.contato.origem === 'sig') {
              aoAtualizarContatoSig(
                emEdicao.contato.competenciasVinculadas.map((c) => c.id),
                {
                  nome: dados.nome,
                  cargo: dados.cargo,
                  email: dados.email,
                  telefone: dados.telefone,
                  ramal: dados.ramal,
                },
              );
            } else {
              aoAtualizarContatoManual(emEdicao.contato.id, dados);
            }
          } else {
            aoCriarContatoManual(dados);
          }
          setEmEdicao(null);
        }}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------

const ModalContato: React.FC<{
  edicao: { modo: 'criar' } | { modo: 'editar'; contato: ContatoIntegrado } | null;
  aoCancelar: () => void;
  aoSalvar: (dados: NovoContatoManual) => void;
}> = ({ edicao, aoCancelar, aoSalvar }) => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useMemo(() => criarEstilos(tema, metricas.compacta), [tema, metricas.compacta]);

  const contatoAtual = edicao?.modo === 'editar' ? edicao.contato : null;
  const eSig = contatoAtual?.origem === 'sig';

  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [secretaria, setSecretaria] = useState('');
  const [setorSigla, setSetorSigla] = useState('');
  const [setor, setSetor] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [ramal, setRamal] = useState('');
  const [observacao, setObservacao] = useState('');

  React.useEffect(() => {
    if (!edicao) return;
    if (edicao.modo === 'editar') {
      const c = edicao.contato;
      setNome(c.nome);
      setCargo(c.cargo);
      setSecretaria(c.secretaria);
      setSetorSigla(c.setorSigla);
      setSetor(c.setor);
      setEmail(c.email ?? '');
      setTelefone(c.telefone ?? '');
      setRamal(c.ramal ?? '');
      setObservacao(c.observacao ?? '');
    } else {
      setNome('');
      setCargo('');
      setSecretaria('');
      setSetorSigla('');
      setSetor('');
      setEmail('');
      setTelefone('');
      setRamal('');
      setObservacao('');
    }
  }, [edicao]);

  const salvar = () => {
    if (!nome.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do responsável ou ponto de contato.');
      return;
    }
    if (!eSig && !secretaria.trim()) {
      Alert.alert('Secretaria obrigatória', 'Informe a secretaria ou órgão de lotação.');
      return;
    }
    aoSalvar({
      nome: nome.trim(),
      cargo: cargo.trim(),
      secretaria: secretaria.trim() || contatoAtual?.secretaria || 'GERAL',
      departamento: secretaria.trim() || contatoAtual?.departamento || 'Geral',
      setorSigla: setorSigla.trim(),
      setor: setor.trim() || setorSigla.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      ramal: ramal.trim(),
      observacao: observacao.trim(),
    });
  };

  return (
    <Modal visible={edicao !== null} transparent animationType="fade" onRequestClose={aoCancelar}>
      <View style={estilos.fundoModal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoCancelar} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={estilos.containerModal}>
          <View style={estilos.janelaModal}>
            <Text style={estilos.tituloModal}>
              {edicao?.modo === 'editar'
                ? eSig
                  ? 'Atualizar Contato Integrado ao SIG'
                  : 'Editar Contato Manual'
                : 'Novo Contato Institucional'}
            </Text>
            {eSig && contatoAtual ? (
              <Text style={estilos.avisoIntegracaoSig}>
                As alterações em e-mail, telefone, ramal e chefia serão sincronizadas automaticamente
                em todas as {contatoAtual.competenciasVinculadas.length} competências vinculadas no SIG.
              </Text>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={estilos.rotuloInput}>Nome do responsável *</Text>
              <TextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Ex.: Coordenação de Cadastro"
                placeholderTextColor={tema.textoTerciario}
                style={estilos.input}
              />

              <Text style={estilos.rotuloInput}>Cargo / Função</Text>
              <TextInput
                value={cargo}
                onChangeText={setCargo}
                placeholder="Ex.: Gerente, Diretor(a), Fiscal"
                placeholderTextColor={tema.textoTerciario}
                style={estilos.input}
              />

              {!eSig ? (
                <>
                  <Text style={estilos.rotuloInput}>Secretaria / Órgão *</Text>
                  <TextInput
                    value={secretaria}
                    onChangeText={setSecretaria}
                    placeholder="Ex.: SEMUR, SEMFAZ, SEMA"
                    placeholderTextColor={tema.textoTerciario}
                    style={estilos.input}
                  />

                  <View style={estilos.linhaDupla}>
                    <View style={estilos.metade}>
                      <Text style={estilos.rotuloInput}>Sigla do Setor</Text>
                      <TextInput
                        value={setorSigla}
                        onChangeText={setSetorSigla}
                        placeholder="Ex.: DICI"
                        placeholderTextColor={tema.textoTerciario}
                        style={estilos.input}
                      />
                    </View>
                    <View style={estilos.metade}>
                      <Text style={estilos.rotuloInput}>Nome do Setor</Text>
                      <TextInput
                        value={setor}
                        onChangeText={setSetor}
                        placeholder="Ex.: Divisão de Controle"
                        placeholderTextColor={tema.textoTerciario}
                        style={estilos.input}
                      />
                    </View>
                  </View>
                </>
              ) : null}

              <Text style={estilos.rotuloInput}>E-mail institucional</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Ex.: setor@portovelho.ro.gov.br"
                placeholderTextColor={tema.textoTerciario}
                keyboardType="email-address"
                autoCapitalize="none"
                style={estilos.input}
              />

              <View style={estilos.linhaDupla}>
                <View style={estilos.metade}>
                  <Text style={estilos.rotuloInput}>Telefone</Text>
                  <TextInput
                    value={telefone}
                    onChangeText={setTelefone}
                    placeholder="(69) 3901-0000"
                    placeholderTextColor={tema.textoTerciario}
                    keyboardType="phone-pad"
                    style={estilos.input}
                  />
                </View>
                <View style={estilos.metade}>
                  <Text style={estilos.rotuloInput}>Ramal</Text>
                  <TextInput
                    value={ramal}
                    onChangeText={setRamal}
                    placeholder="Ex.: 204"
                    placeholderTextColor={tema.textoTerciario}
                    keyboardType="numeric"
                    style={estilos.input}
                  />
                </View>
              </View>

              {!eSig ? (
                <>
                  <Text style={estilos.rotuloInput}>Observação (opcional)</Text>
                  <TextInput
                    value={observacao}
                    onChangeText={setObservacao}
                    placeholder="Horário de atendimento, prédio, etc."
                    placeholderTextColor={tema.textoTerciario}
                    multiline
                    style={[estilos.input, estilos.inputMultilinha]}
                  />
                </>
              ) : null}
            </ScrollView>

            <View style={estilos.rodapeModal}>
              <Pressable onPress={aoCancelar} style={estilos.botaoCancelarModal}>
                <Text style={estilos.textoCancelarModal}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={salvar} style={estilos.botaoSalvarModal}>
                <Text style={estilos.textoSalvarModal}>
                  {eSig ? 'Salvar e sincronizar SIG' : 'Salvar contato'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------

const criarEstilos = (tema: Tema, compacta: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: tema.fundo },
    listaConteudo: { paddingHorizontal: 16, paddingBottom: 92 },
    cabecalho: { paddingTop: 12, marginBottom: 8 },
    titulo: {
      color: tema.texto,
      fontSize: compacta ? 22 : 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    subtitulo: {
      marginTop: 2,
      marginBottom: 10,
      color: tema.textoSecundario,
      fontSize: 12,
    },
    gradeMetricas: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    cardMetrica: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
      alignItems: 'center',
    },
    cardMetricaAtivo: {
      borderColor: tema.primaria,
      backgroundColor: tema.primariaFundo,
    },
    valorMetrica: { fontSize: 16, fontWeight: '800', color: tema.texto },
    rotuloMetrica: {
      fontSize: 9,
      fontWeight: '700',
      color: tema.textoTerciario,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    rolagemFiltros: { marginHorizontal: -16, marginTop: 4 },
    faixaFiltros: { gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    chipAtivo: {
      backgroundColor: tema.primariaFundo,
      borderColor: tema.primaria,
    },
    textoChip: { fontSize: 12, fontWeight: '600', color: tema.textoSecundario },
    textoChipAtivo: { color: tema.primariaTexto, fontWeight: '700' },

    cartao: {
      marginBottom: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    cartaoSemContato: {
      borderColor: '#f59e0b66',
    },
    topoCartao: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoPrincipal: { flex: 1 },
    linhaBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    badgeOrigem: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeSig: { backgroundColor: tema.primariaFundo },
    badgeManual: { backgroundColor: tema.sucessoFundo },
    textoBadgeOrigem: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
    textoBadgeSig: { color: tema.primariaTexto },
    textoBadgeManual: { color: tema.sucesso },
    badgeSecretaria: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBadgeSecretaria: { fontSize: 10, fontWeight: '700', color: tema.textoSecundario },
    badgeAlerta: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: '#f59e0b22',
    },
    textoBadgeAlerta: { fontSize: 9, fontWeight: '800', color: '#b45309' },
    nomeContato: { fontSize: 15, fontWeight: '700', color: tema.texto },
    subtituloContato: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },
    acoesCartao: { flexDirection: 'row', gap: 6 },
    botaoEditar: {
      minHeight: 34,
      paddingHorizontal: 10,
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoEditar: { fontSize: 11, fontWeight: '700', color: tema.texto },
    botaoExcluir: {
      minHeight: 34,
      paddingHorizontal: 10,
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: tema.erroFundo,
    },
    textoBotaoExcluir: { fontSize: 11, fontWeight: '700', color: tema.erro },

    faixaCanais: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    grupoTelefone: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    botaoLigarPill: {
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: tema.primaria,
    },
    textoBotaoLigarPill: {
      fontSize: 11,
      fontWeight: '800',
      color: tema.textoInvertido,
    },
    pillCanal: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    rotuloCanal: {
      fontSize: 9,
      fontWeight: '800',
      color: tema.textoTerciario,
      letterSpacing: 0.4,
    },
    valorCanal: { fontSize: 12, fontWeight: '600', color: tema.texto, marginTop: 1 },
    avisoPreencher: {
      flex: 1,
      padding: 9,
      borderRadius: 8,
      backgroundColor: '#f59e0b14',
      borderWidth: 1,
      borderColor: '#f59e0b44',
    },
    textoAvisoPreencher: { fontSize: 11, fontWeight: '600', color: '#b45309', lineHeight: 16 },
    observacao: {
      marginTop: 8,
      fontSize: 12,
      color: tema.textoSecundario,
      fontStyle: 'italic',
    },

    blocoVinculos: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
    },
    botaoVinculos: { alignSelf: 'flex-start', paddingVertical: 4 },
    textoBotaoVinculos: { fontSize: 11, fontWeight: '700', color: tema.primaria },
    listaVinculos: { marginTop: 6, gap: 6 },
    itemVinculo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoItemVinculo: { flex: 1, fontSize: 11, color: tema.textoSecundario, lineHeight: 15 },
    abrirVinculo: { fontSize: 11, fontWeight: '700', color: tema.primaria },

    vazio: { paddingVertical: 40, alignItems: 'center', paddingHorizontal: 24 },
    tituloVazio: { fontSize: 16, fontWeight: '700', color: tema.texto },
    textoVazio: {
      marginTop: 6,
      fontSize: 13,
      color: tema.textoSecundario,
      textAlign: 'center',
    },

    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: tema.primaria,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    textoFab: { color: tema.textoInvertido, fontSize: 28, fontWeight: '600', lineHeight: 30 },

    fundoModal: {
      flex: 1,
      backgroundColor: tema.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    containerModal: { width: '100%', maxWidth: 520, maxHeight: '88%' },
    janelaModal: {
      backgroundColor: tema.fundoElevado,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 18,
    },
    tituloModal: { fontSize: 17, fontWeight: '800', color: tema.texto, marginBottom: 6 },
    avisoIntegracaoSig: {
      fontSize: 12,
      color: tema.primariaTexto,
      backgroundColor: tema.primariaFundo,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      lineHeight: 17,
    },
    rotuloInput: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.textoSecundario,
      textTransform: 'uppercase',
      marginTop: 10,
      marginBottom: 4,
    },
    input: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tema.texto,
      fontSize: 14,
    },
    inputMultilinha: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    linhaDupla: { flexDirection: 'row', gap: 10 },
    metade: { flex: 1 },
    rodapeModal: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: tema.borda,
    },
    botaoCancelarModal: {
      minHeight: 42,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoCancelarModal: { fontSize: 13, fontWeight: '700', color: tema.texto },
    botaoSalvarModal: {
      minHeight: 42,
      paddingHorizontal: 18,
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: tema.primaria,
    },
    textoSalvarModal: { fontSize: 13, fontWeight: '700', color: tema.textoInvertido },
  });

export default ListaContatos;
