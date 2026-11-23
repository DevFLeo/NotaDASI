import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import SecaoConta from '../auth/SecaoConta';
import { useSessao } from '../auth/useSessao';
import type { Campo } from '../data/campos';
import { lerUrlServidor, salvarUrlServidor } from '../data/integracao';
import type { Registro } from '../data/registros';
import type { AceiteExcelInfo } from '../data/useRegistros';
import {
  validarRegrasPlanilha,
  type QuebraRegra,
  type RelatorioConformidade,
} from '../data/validadorRegrasExcel';
import { importarPlanilhaGenerica, parseCSVouTSV } from '../data/importadorPlanilha';
import { gerarPacoteBackup, lerERestaurarBackupJson } from '../data/backupPortatil';
import { ESCALA_TEXTO_PADRAO } from '../tema/responsivo';
import {
  useEscalaTexto,
  usePreferenciaTema,
  useTema,
  type PreferenciaTema,
} from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import {
  IconeAlerta,
  IconeAparelho,
  IconeBanco,
  IconeCheckCirculo,
  IconeEngrenagem,
  IconeLua,
  IconePlanilha,
  IconeServidor,
  IconeSol,
  IconeUpload,
  IconeX,
} from '../tema/Icones';

type Props = {
  origem: 'planilha' | 'exemplo';
  totalRegistros: number;
  registros?: Registro[];
  aoLimparDados: () => void;
  campoAtivo: Campo;
  totalCampos: number;
  /** Abre o mesmo menu que aparece ao segurar um cartão da lista ou do mapa. */
  aoAbrirCampos: () => void;
  aceiteExcel?: AceiteExcelInfo | null;
  nomePlanilhaAtiva?: string;
  aoSalvarAceiteExcel?: (dados: {
    usuario: string;
    nome: string;
    papel: string;
    justificativa: string;
    totalRegistros: number;
    totalQuebras: number;
    quebrasToleradas: string[];
    nomeArquivo?: string;
  }) => void;
  aoReverterAceiteExcel?: () => void;
  aoCarregarBasePlanilha?: (novos: Registro[], nomeArquivo?: string) => void;
  aoRestaurarBasePadrao?: () => void;
  aoSelecionarRegistro?: (registro: Registro) => void;
};

/** Abaixo desta largura, os dois botões de integração empilham em vez de dividir a linha. */
const LARGURA_ESTREITA = 400;

const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string; Icone: React.FC<{ tamanho?: number; cor: string }> }[] = [
  { valor: 'claro', rotulo: 'Claro', Icone: IconeSol },
  { valor: 'escuro', rotulo: 'Escuro', Icone: IconeLua },
  { valor: 'sistema', rotulo: 'Do aparelho', Icone: IconeAparelho },
];

const OPCOES_ESCALA: { valor: number; rotulo: string; tamanho: number }[] = [
  { valor: 0.85, rotulo: 'Pequeno', tamanho: 11 },
  { valor: ESCALA_TEXTO_PADRAO, rotulo: 'Padrão', tamanho: 13 },
  { valor: 1.2, rotulo: 'Grande', tamanho: 15 },
  { valor: 1.45, rotulo: 'Maior', tamanho: 17 },
];

const presetMaisProximo = (escala: number): number =>
  OPCOES_ESCALA.reduce((melhor, opcao) =>
    Math.abs(opcao.valor - escala) < Math.abs(melhor.valor - escala) ? opcao : melhor,
  ).valor;

const AjustesTela: React.FC<Props> = ({
  origem,
  totalRegistros,
  registros = [],
  aoLimparDados,
  campoAtivo,
  totalCampos,
  aoAbrirCampos,
  aceiteExcel,
  nomePlanilhaAtiva,
  aoSalvarAceiteExcel,
  aoReverterAceiteExcel,
  aoCarregarBasePlanilha,
  aoRestaurarBasePadrao,
  aoSelecionarRegistro,
}) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { width: larguraTela } = useWindowDimensions();
  const estreita = larguraTela < LARGURA_ESTREITA;
  const [preferencia, definirPreferencia] = usePreferenciaTema();
  const [escalaTexto, definirEscalaTexto] = useEscalaTexto();
  const escalaAtiva = presetMaisProximo(escalaTexto);
  const { contaAtual } = useSessao();

  const [urlServidor, setUrlServidor] = useState('');
  const [urlSalva, setUrlSalva] = useState('');

  // Estados do Aceite do Excel
  const [declaracaoCiencia, setDeclaracaoCiencia] = useState(false);
  const [justificativa, setJustificativa] = useState(
    'Homologação do diagnóstico DASI para implantação piloto do SIG Geo 360 (pendências em processo de saneamento)',
  );
  const [mostrarQuebras, setMostrarQuebras] = useState(false);
  const [mostrarTodasQuebras, setMostrarTodasQuebras] = useState(false);
  const [filtroTipoQuebra, setFiltroTipoQuebra] = useState<string>('todos');
  const [modalColarVisivel, setModalColarVisivel] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);

  useEffect(() => {
    lerUrlServidor().then((valor) => {
      setUrlServidor(valor);
      setUrlSalva(valor);
    });
  }, []);

  // Análise de regras de conformidade da planilha
  const relatorio: RelatorioConformidade = useMemo(
    () => validarRegrasPlanilha(registros),
    [registros],
  );

  const quebrasFiltradas = useMemo(() => {
    if (filtroTipoQuebra === 'todos') return relatorio.quebras;
    return relatorio.quebras.filter((q) => q.tipo === filtroTipoQuebra);
  }, [relatorio.quebras, filtroTipoQuebra]);

  const registrosPorId = useMemo(
    () => new Map(registros.map((r) => [r.id, r])),
    [registros],
  );

  const abrirRegistroDaQuebra = (registroId: string) => {
    const alvo = registrosPorId.get(registroId);
    if (alvo && aoSelecionarRegistro) {
      aoSelecionarRegistro(alvo);
    }
  };

  const salvarIntegracao = async () => {
    await salvarUrlServidor(urlServidor);
    setUrlSalva(urlServidor.trim());
    Alert.alert(
      'Endereço salvo',
      'O endereço ficou guardado neste aparelho. A sincronização com o servidor ainda não está ativa — o app continua funcionando 100% local até essa integração ser implementada.',
    );
  };

  const solicitarIntegracao = () => {
    const assunto = encodeURIComponent('Solicitação de integração — NotaDASI');
    const corpo = encodeURIComponent(
      `Gostaria de solicitar a integração do NotaDASI com o servidor remoto (Postgres).\n\nEndereço informado: ${
        urlSalva || '(nenhum ainda)'
      }\n\nDescreva aqui o que precisa: ambiente (produção/homologação), quem mantém o banco, prazo desejado, etc.`,
    );
    Linking.openURL(`mailto:?subject=${assunto}&body=${corpo}`).catch(() => {
      Alert.alert('Não foi possível abrir o e-mail', 'Copie as informações e envie manualmente para o time responsável pelo servidor.');
    });
  };

  const confirmarLimpeza = () => {
    Alert.alert(
      'Limpar dados locais',
      'Isso remove permanentemente as competências criadas, edições, exclusões e favoritos salvos neste aparelho. Os dados da planilha original não são afetados. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: aoLimparDados },
      ],
    );
  };

  // Executa o aceite do Excel nas configurações
  const executarAceiteExcel = () => {
    if (!declaracaoCiencia && relatorio.totalComQuebra > 0) {
      Alert.alert(
        'Declaração Obrigatória',
        'Para aceitar uma planilha com quebra de regras, marque a confirmação de ciência e homologação DASI.',
      );
      return;
    }

    if (!justificativa.trim()) {
      Alert.alert('Justificativa Requerida', 'Insira uma breve justificativa ou despacho para o aceite.');
      return;
    }

    const usuario = contaAtual?.usuario || 'DASI';
    const nome = contaAtual?.nome || 'Operador DASI';
    const papel = contaAtual?.papel || 'dasi';

    const tiposUnicos = Array.from(new Set(relatorio.quebras.map((q) => q.titulo)));

    aoSalvarAceiteExcel?.({
      usuario,
      nome,
      papel,
      justificativa: justificativa.trim(),
      totalRegistros: relatorio.totalRegistros,
      totalQuebras: relatorio.totalComQuebra,
      quebrasToleradas: tiposUnicos,
      nomeArquivo: nomePlanilhaAtiva || 'DIAGNOSTICO_DE_ADESAO_AO_SISTEMA_GEO_360_(2).xlsx',
    });

    Alert.alert(
      'Planilha Homologada com Sucesso',
      `O aceite foi lavrado por ${nome} (${papel.toUpperCase()}). As ${relatorio.totalComQuebra} inconsistências regimentais foram registradas em auditoria e toleradas para tramitação.`,
    );
  };

  const confirmarReversaoAceite = () => {
    Alert.alert(
      'Reverter Aceite',
      'Deseja reabrir a análise de conformidade desta planilha? O status voltará a apontar as quebras de regras até novo despacho.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reverter', style: 'destructive', onPress: () => aoReverterAceiteExcel?.() },
      ],
    );
  };

  // Upload de arquivo via input HTML (Web/PC)
  const selecionarArquivoPlanilha = () => {
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv,.tsv,.json';
      input.onchange = async (e: any) => {
        const arquivo = e.target?.files?.[0];
        if (!arquivo) return;
        setCarregandoArquivo(true);
        try {
          let novos: Registro[] = [];
          if (arquivo.name.endsWith('.json') || arquivo.name.endsWith('.csv') || arquivo.name.endsWith('.tsv')) {
            const texto = await arquivo.text();
            novos = await importarPlanilhaGenerica(texto, arquivo.name);
          } else {
            const buffer = await arquivo.arrayBuffer();
            novos = await importarPlanilhaGenerica(buffer, arquivo.name);
          }

          if (novos.length === 0) {
            Alert.alert('Planilha Vazia', 'Não foram encontradas linhas válidas de competências na planilha selecionada.');
            return;
          }

          aoCarregarBasePlanilha?.(novos, arquivo.name);
          Alert.alert(
            'Planilha Carregada',
            `${novos.length} competências carregadas a partir de "${arquivo.name}". O diagnóstico de regras foi atualizado abaixo para conferência e aceite.`,
          );
        } catch (err: any) {
          Alert.alert('Falha na Importação', err?.message || 'Não foi possível processar o arquivo.');
        } finally {
          setCarregandoArquivo(false);
        }
      };
      input.click();
    } else {
      setModalColarVisivel(true);
    }
  };

  // Importação de texto copiado e colado do Excel
  const importarTabelaColada = () => {
    if (!textoColado.trim()) {
      Alert.alert('Campo Vazio', 'Cole os dados copiados da tabela do Excel ou arquivo CSV.');
      return;
    }
    try {
      const novos = parseCSVouTSV(textoColado);
      if (novos.length === 0) {
        Alert.alert(
          'Formato não reconhecido',
          'Certifique-se de incluir a linha de cabeçalho com os nomes das colunas (ex: Departamento, Setor, Competência).',
        );
        return;
      }
      aoCarregarBasePlanilha?.(novos, 'tabela_colada_excel.tsv');
      setModalColarVisivel(false);
      setTextoColado('');
      Alert.alert(
        'Tabela Importada',
        `${novos.length} competências importadas do texto colado. Revise o diagnóstico de regras abaixo.`,
      );
    } catch (err: any) {
      Alert.alert('Erro ao processar', err?.message || 'Formato inválido.');
    }
  };

  // Exportar termo de aceite em JSON
  const exportarTermoAceite = () => {
    if (!aceiteExcel) return;
    const termo = {
      titulo: 'TERMO DE HOMOLOGAÇÃO E ACEITE EXCEPCIONAL DE PLANILHA — NOTADASI',
      municipio: 'Prefeitura Municipal de Porto Velho',
      orgao: 'Secretaria Municipal de Regularização Fundiária — SEMUR / DRCF',
      sistema: 'SIG Geo 360 / DASI / DGEO',
      aceite: aceiteExcel,
      conformidadeGeral: {
        totalRegistros: relatorio.totalRegistros,
        totalConformes: relatorio.totalConformes,
        totalComQuebra: relatorio.totalComQuebra,
        taxaConformidade: `${relatorio.taxaConformidade}%`,
      },
      pendenciasToleradas: relatorio.quebras.map((q) => ({
        tipo: q.tipo,
        gravidade: q.gravidade,
        secretaria: q.secretaria,
        setor: q.setor,
        motivo: q.titulo,
        detalhe: q.descricao,
      })),
      exportadoEm: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(termo, null, 2);
    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termo_aceite_dasi_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Termo Exportado', `Termo exportado com ${relatorio.quebras.length} ressalvas registradas.`);
    }
  };

  // Exportacao portatil de todos os dados locais para transferir entre PCs (fora do GitHub)
  const exportarBackupCompleto = async () => {
    try {
      const pacote = await gerarPacoteBackup({
        registros,
        aceiteExcel,
        nomePlanilhaAtiva,
      });
      const jsonStr = JSON.stringify(pacote, null, 2);
      const dataStr = new Date().toISOString().slice(0, 10);
      const nomeArquivo = `notadasi-dados-${dataStr}.json`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert(
          'Exportação Concluída',
          `${pacote.totalRegistros} competências exportadas para "${nomeArquivo}". Copie este arquivo para outro PC e use "Importar Base (.json)" ou "npm run dados:importar".`,
        );
      } else {
        Alert.alert(
          'Exportação Disponível no PC',
          `Pacote gerado com ${pacote.totalRegistros} competências. No ambiente desktop (web), o arquivo ${nomeArquivo} é baixado diretamente.`,
        );
      }
    } catch (err: any) {
      Alert.alert('Falha na Exportação', err?.message || 'Não foi possível gerar o arquivo de backup.');
    }
  };

  // Importacao portatil de arquivo .json exportado de outro PC
  const importarBackupCompleto = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e: any) => {
        const arquivo = e.target?.files?.[0];
        if (!arquivo) return;
        setCarregandoArquivo(true);
        try {
          const texto = await arquivo.text();
          const resultado = await lerERestaurarBackupJson(texto, arquivo.name);
          aoCarregarBasePlanilha?.(resultado.registros, resultado.nomeBase);
          Alert.alert(
            'Base Importada com Sucesso',
            `${resultado.registros.length} competências carregadas a partir de "${arquivo.name}".` +
              (resultado.camposRestaurados > 0
                ? ` ${resultado.camposRestaurados} campos livres restaurados.`
                : '') +
              (resultado.posicoesRestauradas > 0
                ? ` Posições do mapa mental restauradas.`
                : ''),
          );
        } catch (err: any) {
          Alert.alert('Falha na Importação', err?.message || 'Não foi possível ler o arquivo JSON.');
        } finally {
          setCarregandoArquivo(false);
        }
      };
      input.click();
    } else {
      Alert.alert(
        'Importação de Backup (.json)',
        'A seleção de arquivo JSON está disponível na versão PC/Web ou via terminal com "npm run dados:importar <arquivo.json>".',
      );
    }
  };

  const formatarData = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  return (
    <ScrollView style={estilos.container} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={estilos.iconeTitulo}>
          <IconeEngrenagem tamanho={22} cor={tema.primaria} />
        </View>
        <Text style={estilos.titulo}>Ajustes</Text>
      </View>

      {/* Identificação de quem está usando o app */}
      <SecaoConta />

      {/* ─────────────────────────────────────────────────────────────
          NOVO BLOCO: Diagnóstico e Aceite da Planilha Excel (SIG Geo 360)
          Regra do DASI: Se quebrar regras regimentais, permite o aceite
          homologado nas configurações.
          ───────────────────────────────────────────────────────────── */}
      <Cartao tema={tema}>
        <View style={estilos.linhaTituloSecao}>
          <IconePlanilha tamanho={17} cor={tema.primaria} />
          <Text style={estilos.tituloSecao}>Diagnóstico e Aceite da Planilha Excel</Text>
        </View>
        <Text style={estilos.descricao}>
          Validação regimental e conformidade do acervo de adesão ao SIG Geo 360 (Prefeitura de Porto Velho).
          Se a planilha contiver regras incompletas ou pendências setoriais, o DASI possui a prerrogativa de
          lavrar o aceite formal neste painel.
        </Text>

        {/* Banner de Status Oficial do Aceite */}
        {aceiteExcel?.aceito ? (
          <View style={[estilos.bannerStatus, { backgroundColor: '#10b98118', borderColor: '#10b98155' }]}>
            <View style={estilos.linhaBanner}>
              <IconeCheckCirculo tamanho={20} cor="#10b981" />
              <View style={estilos.colunaBanner}>
                <Text style={[estilos.tituloBanner, { color: '#059669' }]}>
                  Planilha Excel Homologada — Termo de Aceite Ativo
                </Text>
                <Text style={estilos.textoBannerSub}>
                  Lavrado por <Text style={estilos.destaque}>{aceiteExcel.nome}</Text> ({aceiteExcel.papel.toUpperCase()}) em{' '}
                  {formatarData(aceiteExcel.dataHora)}
                </Text>
                <Text style={[estilos.textoBannerSub, { marginTop: 4, fontStyle: 'italic' }]}>
                  "{aceiteExcel.justificativa}"
                </Text>
                <Text style={[estilos.badgeQuebrasToleradas, { color: '#059669', backgroundColor: '#10b98125' }]}>
                  {aceiteExcel.totalQuebras} regras regimentais toleradas para tramitação
                </Text>
              </View>
            </View>

            <View style={estilos.faixaBotoesAceite}>
              <Pressable onPress={exportarTermoAceite} style={estilos.botaoAcaoCompacto}>
                <Text style={estilos.textoAcaoCompacto}>Exportar Termo (JSON)</Text>
              </Pressable>
              <Pressable onPress={confirmarReversaoAceite} style={estilos.botaoAcaoPerigoCompacto}>
                <Text style={estilos.textoAcaoPerigoCompacto}>Reverter Aceite</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={[
              estilos.bannerStatus,
              relatorio.statusGeral !== 'conforme'
                ? { backgroundColor: '#f59e0b16', borderColor: '#f59e0b55' }
                : { backgroundColor: '#10b98118', borderColor: '#10b98155' },
            ]}>
            <View style={estilos.linhaBanner}>
              {relatorio.statusGeral !== 'conforme' ? (
                <IconeAlerta tamanho={20} cor="#d97706" />
              ) : (
                <IconeCheckCirculo tamanho={20} cor="#10b981" />
              )}
              <View style={estilos.colunaBanner}>
                <Text
                  style={[
                    estilos.tituloBanner,
                    { color: relatorio.statusGeral !== 'conforme' ? '#b45309' : '#059669' },
                  ]}>
                  {relatorio.statusGeral !== 'conforme'
                    ? `Quebra de Regras Detectada (${relatorio.totalComQuebra} registros / ${relatorio.quebras.length} pendências)`
                    : 'Planilha Integralmente Conforme (0 quebras de regra)'}
                </Text>
                <Text style={estilos.textoBannerSub}>
                  {relatorio.statusGeral !== 'conforme'
                    ? 'O diagnóstico contém pendências regimentais (contatos, treinamentos ou lotação). O aceite excepcional pode ser homologado abaixo.'
                    : 'Todos os setores, competências, módulos e contatos atendem ao padrão oficial do município.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quadro de Métricas de Conformidade */}
        <View style={estilos.gradeMetricas}>
          <View style={estilos.cardMetrica}>
            <Text style={estilos.valorMetrica}>{relatorio.totalRegistros}</Text>
            <Text style={estilos.rotuloMetrica}>Competências</Text>
          </View>
          <View style={estilos.cardMetrica}>
            <Text style={[estilos.valorMetrica, { color: '#10b981' }]}>{relatorio.totalConformes}</Text>
            <Text style={estilos.rotuloMetrica}>Conformes</Text>
          </View>
          <Pressable
            onPress={() => {
              if (relatorio.quebras.length > 0) {
                setFiltroTipoQuebra('todos');
                setMostrarQuebras((prev) => !prev);
              }
            }}
            disabled={relatorio.quebras.length === 0}
            accessibilityRole="button"
            accessibilityLabel={`Ver ${relatorio.totalComQuebra} competências com ressalvas`}
            style={({ pressed }) => [
              estilos.cardMetrica,
              relatorio.totalComQuebra > 0 && estilos.cardMetricaInterativo,
              mostrarQuebras && estilos.cardMetricaAtivo,
              pressed && { opacity: 0.8 },
            ]}>
            <Text
              style={[
                estilos.valorMetrica,
                { color: relatorio.totalComQuebra > 0 ? '#f59e0b' : '#10b981' },
              ]}>
              {relatorio.totalComQuebra}
            </Text>
            <Text style={estilos.rotuloMetrica}>Com Ressalvas</Text>
            {relatorio.totalComQuebra > 0 ? (
              <Text style={estilos.dicaMetricaClicavel}>
                {mostrarQuebras ? 'Ocultar ▲' : 'Ver itens ›'}
              </Text>
            ) : null}
          </Pressable>
          <View style={estilos.cardMetrica}>
            <Text style={estilos.valorMetrica}>{relatorio.taxaConformidade}%</Text>
            <Text style={estilos.rotuloMetrica}>Adesão</Text>
          </View>
        </View>

        {/* Botão de Ver Detalhes das Quebras de Regras */}
        {relatorio.quebras.length > 0 && (
          <Pressable
            onPress={() => setMostrarQuebras((prev) => !prev)}
            style={estilos.botaoExpandirQuebras}>
            <Text style={estilos.textoExpandirQuebras}>
              {mostrarQuebras ? 'Recolher detalhes das regras ▲' : `Ver ${relatorio.quebras.length} apontamentos de regras ▼`}
            </Text>
          </Pressable>
        )}

        {/* Lista expansível de inconsistências / quebras */}
        {mostrarQuebras && relatorio.quebras.length > 0 && (
          <View style={estilos.painelQuebras}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.faixaFiltrosQuebra}>
              {[
                { id: 'todos', label: `Todos (${relatorio.quebras.length})` },
                { id: 'CONTATO', label: `Contato (${relatorio.quebrasPorTipo.CONTATO})` },
                { id: 'TREINAMENTO', label: `Treinamento (${relatorio.quebrasPorTipo.TREINAMENTO})` },
                { id: 'SECRETARIA', label: `Secretaria (${relatorio.quebrasPorTipo.SECRETARIA})` },
                { id: 'RESPONSAVEL', label: `Chefia (${relatorio.quebrasPorTipo.RESPONSAVEL})` },
                { id: 'SIG_ATENDIMENTO', label: `Módulo (${relatorio.quebrasPorTipo.SIG_ATENDIMENTO})` },
              ].map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setFiltroTipoQuebra(f.id)}
                  style={[
                    estilos.chipFiltro,
                    filtroTipoQuebra === f.id && estilos.chipFiltroAtivo,
                  ]}>
                  <Text
                    style={[
                      estilos.textoChipFiltro,
                      filtroTipoQuebra === f.id && estilos.textoChipFiltroAtivo,
                    ]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={estilos.listaItensQuebra}>
              {(mostrarTodasQuebras ? quebrasFiltradas : quebrasFiltradas.slice(0, 15)).map((q: QuebraRegra) => {
                const corGravidade =
                  q.gravidade === 'alta' ? '#ef4444' : q.gravidade === 'media' ? '#f59e0b' : '#3b82f6';
                const podeAbrir = Boolean(aoSelecionarRegistro && registrosPorId.has(q.registroId));
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => abrirRegistroDaQuebra(q.registroId)}
                    disabled={!podeAbrir}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir competência: ${q.titulo} (${q.secretaria} - ${q.setor})`}
                    style={({ pressed }) => [
                      estilos.itemQuebra,
                      podeAbrir && estilos.itemQuebraClicavel,
                      pressed && estilos.itemQuebraPressionado,
                    ]}>
                    <View style={estilos.linhaItemQuebraTopo}>
                      <View style={[estilos.badgeGravidade, { backgroundColor: `${corGravidade}20` }]}>
                        <Text style={[estilos.textoBadgeGravidade, { color: corGravidade }]}>
                          {q.gravidade.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={estilos.tituloItemQuebra}>{q.titulo}</Text>
                      {podeAbrir ? (
                        <Text style={estilos.linkAbrirQuebra}>Abrir ›</Text>
                      ) : null}
                    </View>
                    <Text style={estilos.contextoItemQuebra}>
                      {q.secretaria} • {q.setor}
                    </Text>
                    <Text style={estilos.descItemQuebra} numberOfLines={2}>
                      {q.competencia}
                    </Text>
                    <Text style={estilos.sugestaoItemQuebra}>Pendência: {q.descricao} · Ajuste: {q.sugestaoAjuste}</Text>
                  </Pressable>
                );
              })}
              {quebrasFiltradas.length > 15 && (
                <Pressable
                  onPress={() => setMostrarTodasQuebras((prev) => !prev)}
                  style={estilos.botaoExpandirQuebras}
                  accessibilityRole="button">
                  <Text style={estilos.textoExpandirQuebras}>
                    {mostrarTodasQuebras
                      ? 'Mostrar menos itens ▲'
                      : `Mostrar todos os ${quebrasFiltradas.length} apontamentos ▼`}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Formulário de Lavratura do Aceite do Excel */}
        {!aceiteExcel?.aceito && (
          <View style={estilos.blocoFormAceite}>
            <Text style={estilos.subtituloAceite}>Termo de Aceite Excepcional (DASI)</Text>
            <Text style={estilos.descricaoPequena}>
              O DASI é o agente prioritário na alimentação e governança do acervo de adesão. O aceite abaixo
              homologa formalmente a planilha ativa, registrando as inconsistências toleradas em histórico
              auditável da Prefeitura.
            </Text>

            <Pressable
              onPress={() => setDeclaracaoCiencia((prev) => !prev)}
              style={estilos.linhaCheckboxAceite}>
              <View
                style={[
                  estilos.caixaCheckbox,
                  declaracaoCiencia && estilos.caixaCheckboxMarcada,
                ]}>
                {declaracaoCiencia && <Text style={estilos.checkV}>✓</Text>}
              </View>
              <Text style={estilos.textoCheckboxAceite}>
                Declaro ciência das {relatorio.totalComQuebra} regras regimentais com ressalva e autorizo o aceite
                desta planilha para continuidade do trâmite do SIG Geo 360.
              </Text>
            </Pressable>

            <View style={estilos.bloco}>
              <Text style={estilos.rotulo}>Despacho / Justificativa Administrativa</Text>
              <TextInput
                value={justificativa}
                onChangeText={setJustificativa}
                placeholder="Insira a motivação do aceite"
                placeholderTextColor={tema.textoTerciario}
                style={[estilos.input, { minHeight: 46 }]}
                multiline
              />
            </View>

            <Pressable
              onPress={executarAceiteExcel}
              disabled={relatorio.totalComQuebra > 0 && !declaracaoCiencia}
              style={[
                estilos.botaoAceitePrincipal,
                relatorio.totalComQuebra > 0 && !declaracaoCiencia && estilos.botaoDesabilitado,
              ]}>
              <IconeCheckCirculo tamanho={18} cor="#fff" />
              <Text style={estilos.textoBotaoAceitePrincipal}>
                HOMOLOGAR E ACEITAR PLANILHA EXCEL
              </Text>
            </Pressable>
          </View>
        )}

        {/* Ações de Carga e Troca da Planilha */}
        <View style={estilos.faixaBotoesCarga}>
          <Pressable onPress={selecionarArquivoPlanilha} style={estilos.botaoCarga}>
            <IconeUpload tamanho={16} cor={tema.primaria} />
            <Text style={estilos.textoBotaoCarga}>
              {carregandoArquivo ? 'Processando...' : 'Carregar Nova Planilha (.xlsx, .csv)'}
            </Text>
          </Pressable>

          <Pressable onPress={() => setModalColarVisivel(true)} style={estilos.botaoCarga}>
            <IconePlanilha tamanho={16} cor={tema.primaria} />
            <Text style={estilos.textoBotaoCarga}>Colar Tabela do Excel</Text>
          </Pressable>

          {nomePlanilhaAtiva && (
            <Pressable onPress={aoRestaurarBasePadrao} style={estilos.botaoCargaRestaurar}>
              <Text style={estilos.textoBotaoCargaRestaurar}>Restaurar Base Padrão Geo 360</Text>
            </Pressable>
          )}
        </View>
      </Cartao>

      {/* Modal para colar tabela copiada diretamente do Excel */}
      <Modal visible={modalColarVisivel} transparent animationType="fade">
        <View style={estilos.fundoModal}>
          <View style={estilos.janelaModal}>
            <View style={estilos.topoModal}>
              <Text style={estilos.tituloModal}>Colar Tabela do Excel</Text>
              <Pressable onPress={() => setModalColarVisivel(false)} style={estilos.fecharModal}>
                <IconeX tamanho={18} cor={tema.textoSecundario} />
              </Pressable>
            </View>
            <Text style={estilos.descricaoModal}>
              Copie as células no Excel (incluindo o cabeçalho) com Ctrl+C e cole no campo abaixo com Ctrl+V:
            </Text>
            <TextInput
              value={textoColado}
              onChangeText={setTextoColado}
              placeholder="Cole aqui as linhas da planilha (Departamento, Setor, Competência...)"
              placeholderTextColor={tema.textoTerciario}
              multiline
              style={estilos.areaTextoModal}
            />
            <View style={estilos.botoesModal}>
              <Pressable onPress={() => setModalColarVisivel(false)} style={estilos.botaoModalCancelar}>
                <Text style={estilos.textoModalCancelar}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={importarTabelaColada} style={estilos.botaoModalConfirmar}>
                <Text style={estilos.textoModalConfirmar}>Processar Tabela</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Cartao tema={tema}>
        <Text style={estilos.tituloSecao}>Aparência</Text>
        <Text style={estilos.descricao}>Escolha como o NotaDASI aparece neste aparelho.</Text>
        <View style={estilos.faixaChips}>
          {OPCOES_TEMA.map((opcao) => {
            const ativo = preferencia === opcao.valor;
            const corIcone = ativo ? tema.primariaTexto : tema.textoSecundario;
            return (
              <Pressable
                key={opcao.valor}
                onPress={() => definirPreferencia(opcao.valor)}
                style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <opcao.Icone tamanho={15} cor={corIcone} />
                <Text style={[estilos.textoChip, ativo && estilos.textoChipAtivo]}>{opcao.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={estilos.rotuloEscala}>Tamanho do texto da lista</Text>
        <View style={estilos.faixaChips}>
          {OPCOES_ESCALA.map((opcao) => {
            const ativo = escalaAtiva === opcao.valor;
            return (
              <Pressable
                key={opcao.valor}
                onPress={() => definirEscalaTexto(opcao.valor)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`Texto ${opcao.rotulo.toLowerCase()}`}
                style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <Text
                  style={[
                    estilos.textoChip,
                    { fontSize: opcao.tamanho },
                    ativo && estilos.textoChipAtivo,
                  ]}
                  maxFontSizeMultiplier={1.2}>
                  {opcao.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={estilos.descricao}>
          Vale {Math.round(escalaTexto * 100)}% do tamanho normal. Na aba Lista, você também pode
          ajustar com uma pinça de dois dedos — o valor fica salvo neste aparelho.
        </Text>
      </Cartao>

      <Cartao tema={tema}>
        <View style={estilos.linhaTituloSecao}>
          <IconeBanco tamanho={16} cor={tema.primaria} />
          <Text style={estilos.tituloSecao}>Campos</Text>
        </View>
        <Text style={estilos.descricao}>
          Cada campo é um cofre separado, com os próprios itens e o próprio formulário de cadastro.
          O atalho também está na barra de baixo: segure a aba Lista ou Mapa mental.
        </Text>
        <Campo tema={tema} rotulo="Campo ativo" valor={campoAtivo.nome} />
        <Campo
          tema={tema}
          rotulo="Campos neste aparelho"
          valor={`${totalCampos} (o do SIG é o padrão)`}
        />
        <Pressable onPress={aoAbrirCampos} style={estilos.botaoSecundarioLargo}>
          <Text style={estilos.textoBotaoSecundario}>Gerenciar campos</Text>
        </Pressable>
      </Cartao>

      <Cartao tema={tema}>
        <View style={estilos.linhaTituloSecao}>
          <IconeBanco tamanho={16} cor={tema.primaria} />
          <Text style={estilos.tituloSecao}>Dados Locais e Portabilidade</Text>
        </View>
        <Text style={estilos.descricao}>
          Os dados institucionais ficam separados do repositório GitHub (.gitignore). Para levar suas
          informações para outro PC de desenvolvimento, exporte o pacote completo em JSON e importe-o
          na outra máquina.
        </Text>
        <Campo
          tema={tema}
          rotulo="Origem dos dados"
          valor={
            nomePlanilhaAtiva
              ? `Base ativa: ${nomePlanilhaAtiva}`
              : origem === 'planilha'
              ? `Base local carregada (${totalRegistros} competências)`
              : 'Dados de exemplo (fictícios)'
          }
        />
        <Campo tema={tema} rotulo="Competências carregadas" valor={String(totalRegistros)} />
        <Campo tema={tema} rotulo="Armazenamento" valor="Local, neste aparelho (AsyncStorage / IndexedDB)" />

        <View style={[estilos.linhaBotoes, estreita && estilos.linhaBotoesEmpilhada]}>
          <Pressable
            onPress={exportarBackupCompleto}
            accessibilityRole="button"
            style={estilos.botaoPrimario}>
            <Text style={estilos.textoBotaoPrimario}>Exportar Base (.json)</Text>
          </Pressable>
          <Pressable
            onPress={importarBackupCompleto}
            accessibilityRole="button"
            style={estilos.botaoSecundario}>
            <Text style={estilos.textoBotaoSecundario}>Importar Base (.json)</Text>
          </Pressable>
        </View>

        <Pressable onPress={confirmarLimpeza} style={estilos.botaoPerigo}>
          <Text style={estilos.textoBotaoPerigo}>Limpar dados locais</Text>
        </Pressable>
      </Cartao>

      <Cartao tema={tema}>
        <View style={estilos.linhaTituloSecao}>
          <IconeServidor tamanho={16} cor={tema.primaria} />
          <Text style={estilos.tituloSecao}>Integração com servidor</Text>
        </View>
        <Text style={estilos.descricao}>
          O NotaDASI funciona hoje inteiramente neste aparelho. Já existe um esquema de banco (Postgres)
          preparado em <Text style={estilos.destaque}>db/schema.sql</Text> com isolamento de schema{' '}
          <Text style={estilos.destaque}>notadasi</Text> para quando um servidor remoto estiver disponível.
        </Text>

        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Endereço do servidor (API)</Text>
          <TextInput
            value={urlServidor}
            onChangeText={setUrlServidor}
            placeholder="https://api.exemplo.gov.br/notadasi"
            placeholderTextColor={tema.textoTerciario}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={estilos.input}
          />
        </View>

        <View style={[estilos.linhaBotoes, estreita && estilos.linhaBotoesEmpilhada]}>
          <Pressable onPress={salvarIntegracao} style={estilos.botaoSecundario}>
            <Text style={estilos.textoBotaoSecundario}>Salvar endereço</Text>
          </Pressable>
          <Pressable onPress={solicitarIntegracao} style={estilos.botaoPrimario}>
            <Text style={estilos.textoBotaoPrimario}>Solicitar integração</Text>
          </Pressable>
        </View>

        <View style={[estilos.selo, { backgroundColor: tema.alertaFundo }]}>
          <Text style={[estilos.textoSelo, { color: tema.alerta }]}>
            Status: modo local — servidor ainda não conectado
          </Text>
        </View>
      </Cartao>

      <Text style={estilos.rodape}>NotaDASI · v0.2 · Prefeitura de Porto Velho</Text>
    </ScrollView>
  );
};

const Cartao: React.FC<{ tema: Tema; children: React.ReactNode }> = ({ tema, children }) => {
  const estilos = criarEstilos(tema);
  return <View style={estilos.cartao}>{children}</View>;
};

const Campo: React.FC<{ tema: Tema; rotulo: string; valor: string }> = ({ tema, rotulo, valor }) => {
  const estilos = criarEstilos(tema);
  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valorCampo}>{valor}</Text>
    </View>
  );
};

const criarEstilos = (tema: Tema) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: tema.fundo },
    conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 4 },
    iconeTitulo: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: tema.primariaFundo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { color: tema.texto, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
    cartao: {
      backgroundColor: tema.fundoElevado,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 16,
      marginTop: 14,
    },
    linhaTituloSecao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    tituloSecao: {
      color: tema.primaria,
      fontSize: 13,
      fontWeight: '700',
    },
    descricao: { color: tema.textoSecundario, fontSize: 13, lineHeight: 19, marginTop: 6 },
    descricaoPequena: { color: tema.textoSecundario, fontSize: 12, lineHeight: 17, marginTop: 4 },
    destaque: { color: tema.texto, fontWeight: '700' },
    faixaChips: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' },
    rotuloEscala: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 18,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    chipAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
    textoChip: { color: tema.textoSecundario, fontSize: 12, fontWeight: '600' },
    textoChipAtivo: { color: tema.primariaTexto },
    bloco: { marginTop: 12 },
    rotulo: {
      color: tema.textoTerciario,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    valorCampo: { color: tema.texto, fontSize: 14, lineHeight: 20 },
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
    linhaBotoes: { flexDirection: 'row', gap: 10, marginTop: 14 },
    linhaBotoesEmpilhada: { flexDirection: 'column' },
    botaoPrimario: {
      flex: 1,
      backgroundColor: tema.primaria,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    textoBotaoPrimario: { color: tema.textoInvertido, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    botaoSecundario: {
      flex: 1,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    textoBotaoSecundario: { color: tema.texto, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    botaoSecundarioLargo: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    botaoPerigo: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tema.erroFundo,
    },
    textoBotaoPerigo: { color: tema.erro, fontSize: 12, fontWeight: '700' },
    selo: {
      marginTop: 14,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    textoSelo: { fontSize: 11, fontWeight: '700' },
    rodape: {
      textAlign: 'center',
      color: tema.textoTerciario,
      fontSize: 12,
      marginTop: 24,
    },

    // Estilos do bloco de Diagnóstico e Aceite do Excel
    bannerStatus: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    linhaBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    colunaBanner: { flex: 1 },
    tituloBanner: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
    textoBannerSub: { fontSize: 12, color: tema.textoSecundario, marginTop: 3, lineHeight: 17 },
    badgeQuebrasToleradas: {
      marginTop: 8,
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    faixaBotoesAceite: { flexDirection: 'row', gap: 8, marginTop: 12 },
    botaoAcaoCompacto: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 8,
    },
    textoAcaoCompacto: { fontSize: 11, fontWeight: '700', color: tema.texto },
    botaoAcaoPerigoCompacto: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tema.erroFundo,
      borderRadius: 8,
    },
    textoAcaoPerigoCompacto: { fontSize: 11, fontWeight: '700', color: tema.erro },
    gradeMetricas: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    cardMetrica: {
      flex: 1,
      minWidth: 70,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
    },
    cardMetricaInterativo: {
      borderColor: '#f59e0b66',
      backgroundColor: '#f59e0b0d',
      cursor: (Platform.OS === 'web' ? 'pointer' : undefined) as any,
    },
    cardMetricaAtivo: {
      borderWidth: 1.5,
      borderColor: '#f59e0b',
      backgroundColor: '#f59e0b1a',
    },
    dicaMetricaClicavel: {
      fontSize: 9,
      fontWeight: '700',
      color: '#b45309',
      marginTop: 4,
    },
    valorMetrica: { fontSize: 18, fontWeight: '800', color: tema.texto },
    rotuloMetrica: { fontSize: 10, fontWeight: '600', color: tema.textoTerciario, marginTop: 2, textTransform: 'uppercase' },
    botaoExpandirQuebras: {
      marginTop: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      alignItems: 'center',
    },
    textoExpandirQuebras: { fontSize: 12, fontWeight: '700', color: tema.primaria },
    painelQuebras: {
      marginTop: 10,
      padding: 12,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 14,
    },
    faixaFiltrosQuebra: { flexDirection: 'row', marginBottom: 10 },
    chipFiltro: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: tema.fundo,
      borderWidth: 1,
      borderColor: tema.borda,
      marginRight: 6,
    },
    chipFiltroAtivo: { backgroundColor: tema.primariaFundo, borderColor: tema.primaria },
    textoChipFiltro: { fontSize: 11, fontWeight: '600', color: tema.textoSecundario },
    textoChipFiltroAtivo: { color: tema.primariaTexto },
    listaItensQuebra: { gap: 8 },
    itemQuebra: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: tema.fundoElevado,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    itemQuebraClicavel: {
      cursor: (Platform.OS === 'web' ? 'pointer' : undefined) as any,
    },
    itemQuebraPressionado: {
      opacity: 0.78,
      borderColor: tema.primaria,
    },
    linkAbrirQuebra: {
      fontSize: 11,
      fontWeight: '700',
      color: tema.primaria,
    },
    linhaItemQuebraTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgeGravidade: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    textoBadgeGravidade: { fontSize: 9, fontWeight: '800' },
    tituloItemQuebra: { fontSize: 12, fontWeight: '700', color: tema.texto, flex: 1 },
    contextoItemQuebra: { fontSize: 11, fontWeight: '600', color: tema.primaria, marginTop: 2 },
    descItemQuebra: { fontSize: 12, color: tema.textoSecundario, marginTop: 4, lineHeight: 16 },
    sugestaoItemQuebra: { fontSize: 11, color: tema.textoTerciario, marginTop: 4, fontStyle: 'italic' },
    avisoMaisItens: { fontSize: 11, textAlign: 'center', color: tema.textoTerciario, paddingVertical: 6 },
    blocoFormAceite: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.primariaFundo,
    },
    subtituloAceite: { fontSize: 14, fontWeight: '700', color: tema.texto },
    linhaCheckboxAceite: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
    caixaCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: tema.borda,
      backgroundColor: tema.fundo,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    caixaCheckboxMarcada: { backgroundColor: tema.primaria, borderColor: tema.primaria },
    checkV: { color: '#fff', fontSize: 13, fontWeight: '900' },
    textoCheckboxAceite: { flex: 1, fontSize: 12, color: tema.texto, lineHeight: 17, fontWeight: '500' },
    botaoAceitePrincipal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#059669',
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 14,
    },
    botaoDesabilitado: { opacity: 0.5 },
    textoBotaoAceitePrincipal: { color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
    faixaBotoesCarga: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    botaoCarga: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoCarga: { fontSize: 11, fontWeight: '700', color: tema.primaria },
    botaoCargaRestaurar: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
    },
    textoBotaoCargaRestaurar: { fontSize: 11, fontWeight: '700', color: tema.textoTerciario },

    // Modal de colar tabela do Excel
    fundoModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    janelaModal: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: tema.fundoElevado,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tema.borda,
      padding: 20,
    },
    topoModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tituloModal: { fontSize: 18, fontWeight: '700', color: tema.texto },
    fecharModal: { padding: 4 },
    descricaoModal: { fontSize: 12, color: tema.textoSecundario, marginTop: 8, lineHeight: 18 },
    areaTextoModal: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borda,
      borderRadius: 10,
      padding: 12,
      color: tema.texto,
      fontSize: 12,
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
      minHeight: 180,
      textAlignVertical: 'top',
      marginTop: 12,
    },
    botoesModal: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
    botaoModalCancelar: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
    textoModalCancelar: { fontSize: 12, fontWeight: '600', color: tema.textoSecundario },
    botaoModalConfirmar: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: tema.primaria,
    },
    textoModalConfirmar: { fontSize: 12, fontWeight: '700', color: tema.textoInvertido },
  });

export default AjustesTela;
