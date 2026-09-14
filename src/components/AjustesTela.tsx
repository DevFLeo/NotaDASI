import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { lerUrlServidor, salvarUrlServidor } from '../data/integracao';
import { usePreferenciaTema, useTema, type PreferenciaTema } from '../tema/ThemeContext';
import type { Tema } from '../tema/cores';
import {
  IconeAparelho,
  IconeBanco,
  IconeEngrenagem,
  IconeLua,
  IconeServidor,
  IconeSol,
} from '../tema/Icones';

type Props = {
  origem: 'planilha' | 'exemplo';
  totalRegistros: number;
  aoLimparDados: () => void;
};

/** Abaixo desta largura, os dois botões de integração empilham em vez de dividir a linha. */
const LARGURA_ESTREITA = 400;

const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string; Icone: React.FC<{ tamanho?: number; cor: string }> }[] = [
  { valor: 'claro', rotulo: 'Claro', Icone: IconeSol },
  { valor: 'escuro', rotulo: 'Escuro', Icone: IconeLua },
  { valor: 'sistema', rotulo: 'Do aparelho', Icone: IconeAparelho },
];

const AjustesTela: React.FC<Props> = ({ origem, totalRegistros, aoLimparDados }) => {
  const tema = useTema();
  const estilos = criarEstilos(tema);
  const { width: larguraTela } = useWindowDimensions();
  const estreita = larguraTela < LARGURA_ESTREITA;
  const [preferencia, definirPreferencia] = usePreferenciaTema();

  const [urlServidor, setUrlServidor] = useState('');
  const [urlSalva, setUrlSalva] = useState('');

  useEffect(() => {
    lerUrlServidor().then((valor) => {
      setUrlServidor(valor);
      setUrlSalva(valor);
    });
  }, []);

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

  return (
    <ScrollView style={estilos.container} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={estilos.iconeTitulo}>
          <IconeEngrenagem tamanho={22} cor={tema.primaria} />
        </View>
        <Text style={estilos.titulo}>Ajustes</Text>
      </View>

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
      </Cartao>

      <Cartao tema={tema}>
        <View style={estilos.linhaTituloSecao}>
          <IconeBanco tamanho={16} cor={tema.primaria} />
          <Text style={estilos.tituloSecao}>Dados</Text>
        </View>
        <Campo tema={tema} rotulo="Origem dos dados" valor={origem === 'planilha' ? 'Planilha importada' : 'Dados de exemplo'} />
        <Campo tema={tema} rotulo="Competências carregadas" valor={String(totalRegistros)} />
        <Campo tema={tema} rotulo="Armazenamento" valor="Local, neste aparelho (AsyncStorage)" />
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
          preparado em <Text style={estilos.destaque}>db/schema.sql</Text> para quando um servidor remoto
          estiver disponível — o endereço abaixo fica só guardado por enquanto, nada é enviado até a
          integração ser ativada pela equipe técnica.
        </Text>

        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Endereço do servidor (API)</Text>
          <TextInput
            value={urlServidor}
            onChangeText={setUrlServidor}
            placeholder="https://api.exemplo.gov.br"
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

      <Text style={estilos.rodape}>NotaDASI · v1.0</Text>
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
    destaque: { color: tema.texto, fontWeight: '700' },
    faixaChips: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
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
  });

export default AjustesTela;
