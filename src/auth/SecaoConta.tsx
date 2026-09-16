import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useSessao } from './useSessao';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useTema } from '../tema/ThemeContext';

/**
 * Bloco "Conta" da tela de Ajustes — quem está usando o app, trocar a senha e
 * sair.
 *
 * Vive em `src/auth/` (e não dentro de AjustesTela) porque é a única parte da
 * tela que mexe na sessão: quem for ler o fluxo de login encontra tudo numa
 * pasta só. Como é React Native puro, aparece igual no celular e no PC.
 */
export const SecaoConta: React.FC = () => {
  const tema = useTema();
  const estilos = useEstilos(criarEstilosConta);
  const { contaAtual, sair, trocarSenha } = useSessao();

  const [trocando, setTrocando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  if (!contaAtual) {
    return null;
  }

  const fecharTroca = () => {
    setTrocando(false);
    setSenhaAtual('');
    setSenhaNova('');
    setErro(null);
  };

  const confirmarTroca = () => {
    const resultado = trocarSenha(senhaAtual, senhaNova);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }

    fecharTroca();
    Alert.alert(
      'Senha alterada',
      'A nova senha vale para esta conta neste aparelho. Os outros aparelhos continuam com a senha antiga até existir o servidor.',
    );
  };

  const confirmarSaida = () => {
    Alert.alert(
      'Sair da conta',
      `Encerrar a sessão de ${contaAtual.nome}? Os dados cadastrados continuam salvos neste aparelho.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: sair },
      ],
    );
  };

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.tituloSecao}>Conta</Text>

      <View style={estilos.identidade}>
        <View style={estilos.avatar}>
          <Text style={estilos.inicial}>{contaAtual.nome.slice(0, 1)}</Text>
        </View>
        <View style={estilos.textosIdentidade}>
          <Text style={estilos.nome} numberOfLines={1}>
            {contaAtual.nome}
          </Text>
          <Text style={estilos.descricao} numberOfLines={2}>
            {contaAtual.descricao}
          </Text>
        </View>
      </View>

      {trocando ? (
        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Senha atual</Text>
          <TextInput
            value={senhaAtual}
            onChangeText={(texto) => {
              setSenhaAtual(texto);
              setErro(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor={tema.textoTerciario}
            style={estilos.input}
          />

          <Text style={estilos.rotulo}>Nova senha</Text>
          <TextInput
            value={senhaNova}
            onChangeText={(texto) => {
              setSenhaNova(texto);
              setErro(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={confirmarTroca}
            placeholderTextColor={tema.textoTerciario}
            style={estilos.input}
          />

          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

          <View style={estilos.linhaBotoes}>
            <Pressable onPress={fecharTroca} style={estilos.botaoNeutro}>
              <Text style={estilos.textoBotaoNeutro}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={confirmarTroca} style={estilos.botaoPrimario}>
              <Text style={estilos.textoBotaoPrimario}>Salvar senha</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={estilos.linhaBotoes}>
          <Pressable onPress={() => setTrocando(true)} style={estilos.botaoNeutro}>
            <Text style={estilos.textoBotaoNeutro}>Trocar senha</Text>
          </Pressable>
          <Pressable onPress={confirmarSaida} style={estilos.botaoSair}>
            <Text style={estilos.textoBotaoSair}>Sair</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const criarEstilosConta = criarEstilos((tema, m) => ({
  cartao: {
    backgroundColor: tema.fundoElevado,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.borda,
    padding: m.compacta ? 16 : 20,
    marginBottom: m.espaco,
  },
  tituloSecao: {
    color: tema.texto,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.primariaFundo,
  },
  inicial: { color: tema.primariaTexto, fontSize: 18, fontWeight: '800' },
  textosIdentidade: { flex: 1, minWidth: 0 },
  nome: { color: tema.texto, fontSize: 15, fontWeight: '700' },
  descricao: { color: tema.textoSecundario, fontSize: 12, lineHeight: 17, marginTop: 2 },
  bloco: { marginTop: 14 },
  rotulo: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    paddingVertical: 10,
    color: tema.texto,
    fontSize: 14,
  },
  erro: { color: tema.erro, fontSize: 12, fontWeight: '600', marginTop: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  botaoNeutro: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.superficie,
  },
  textoBotaoNeutro: { color: tema.texto, fontSize: 12, fontWeight: '700' },
  botaoPrimario: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.primaria,
  },
  textoBotaoPrimario: { color: tema.textoInvertido, fontSize: 12, fontWeight: '700' },
  botaoSair: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.erroFundo,
  },
  textoBotaoSair: { color: tema.erro, fontSize: 12, fontWeight: '700' },
}));

export default SecaoConta;
