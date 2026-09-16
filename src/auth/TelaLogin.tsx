import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SENHA_INICIAL, type Conta } from './contas';
import { useSessao } from './useSessao';
import { criarEstilos } from '../tema/estilos';
import { useEstilos, useMetricas, useTema } from '../tema/ThemeContext';

/**
 * Porta de entrada do app — a MESMA no celular e no PC.
 *
 * É React Native puro (nada de DOM), então o react-native-web a renderiza no
 * navegador sem uma segunda versão. O layout se adapta pelas métricas da
 * janela: num celular estreito o cartão ocupa a tela toda; num monitor ele
 * para de crescer em `larguraMaxModal` e fica centralizado.
 */
const TelaLogin: React.FC = () => {
  const tema = useTema();
  const metricas = useMetricas();
  const estilos = useEstilos(criarEstilosLogin);
  const { contas, entrar } = useSessao();

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = () => {
    if (!usuario.trim()) {
      setErro('Escolha uma conta acima ou digite o nome dela.');
      return;
    }

    const resultado = entrar(usuario, senha);
    setErro(resultado.ok ? null : resultado.erro);
  };

  const escolher = (conta: Conta) => {
    setUsuario(conta.nome);
    setSenha('');
    setErro(null);
  };

  const selecionada = (conta: Conta): boolean =>
    conta.nome.toLowerCase() === usuario.trim().toLowerCase();

  return (
    <View style={estilos.fundo}>
      <ScrollView
        contentContainerStyle={estilos.rolagem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={estilos.cartao}>
          <Text style={estilos.marca}>NotaDASI</Text>
          <Text style={estilos.titulo}>Entrar</Text>
          <Text style={estilos.descricao}>
            Escolha a conta que vai usar o app neste {metricas.expandida ? 'computador' : 'aparelho'}
            . A escolha fica salva — só é pedida de novo se você sair.
          </Text>

          <Text style={estilos.secao}>Contas</Text>

          {contas.map((conta) => {
            const ativa = selecionada(conta);
            const dica = SENHA_INICIAL[conta.usuario];

            return (
              <Pressable
                key={conta.usuario}
                onPress={() => escolher(conta)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativa }}
                style={[estilos.linhaConta, ativa && estilos.linhaContaAtiva]}>
                <View style={estilos.textosConta}>
                  <Text
                    style={[estilos.nomeConta, ativa && estilos.nomeContaAtivo]}
                    numberOfLines={1}>
                    {conta.nome}
                  </Text>
                  <Text style={estilos.descricaoConta} numberOfLines={2}>
                    {conta.descricao}
                  </Text>
                </View>
                {conta.padrao && dica ? <Text style={estilos.selo}>senha: {dica}</Text> : null}
              </Pressable>
            );
          })}

          <Text style={estilos.rotulo}>Conta</Text>
          <TextInput
            value={usuario}
            onChangeText={(texto) => {
              setUsuario(texto);
              setErro(null);
            }}
            placeholder="Ex.: DASI"
            placeholderTextColor={tema.textoTerciario}
            autoCapitalize="characters"
            autoCorrect={false}
            style={estilos.input}
          />

          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput
            value={senha}
            onChangeText={(texto) => {
              setSenha(texto);
              setErro(null);
            }}
            placeholder="••••••"
            placeholderTextColor={tema.textoTerciario}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            // No PC dá para entrar sem tirar a mão do teclado.
            onSubmitEditing={confirmar}
            returnKeyType="go"
            style={estilos.input}
          />

          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

          <Pressable onPress={confirmar} accessibilityRole="button" style={estilos.botao}>
            <Text style={estilos.textoBotao}>Entrar</Text>
          </Pressable>

          <Text style={estilos.rodape}>
            As contas ficam salvas só neste {metricas.expandida ? 'computador' : 'aparelho'}. Trocar
            a senha aqui não muda a senha nos outros — isso só acontece quando o servidor existir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const criarEstilosLogin = criarEstilos((tema, m) => ({
  fundo: { flex: 1, backgroundColor: tema.fundo },
  rolagem: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: m.margem,
  },
  cartao: {
    width: '100%',
    // Num monitor o cartão para de crescer e fica centralizado; no celular
    // ocupa a largura toda.
    maxWidth: Math.min(460, m.larguraMaxModal),
    backgroundColor: tema.fundoElevado,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tema.borda,
    padding: m.compacta ? 18 : 26,
  },
  marca: {
    color: tema.primariaTexto,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  titulo: { color: tema.texto, fontSize: m.compacta ? 22 : 26, fontWeight: '800', marginTop: 6 },
  descricao: { color: tema.textoSecundario, fontSize: 13, lineHeight: 19, marginTop: 6 },
  secao: {
    color: tema.textoTerciario,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
  },
  linhaConta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  linhaContaAtiva: { borderColor: tema.primaria, backgroundColor: tema.primariaFundo },
  textosConta: { flex: 1, minWidth: 0 },
  nomeConta: { color: tema.texto, fontSize: 15, fontWeight: '700' },
  nomeContaAtivo: { color: tema.primariaTexto },
  descricaoConta: { color: tema.textoSecundario, fontSize: 11, marginTop: 3, lineHeight: 15 },
  selo: {
    color: tema.textoTerciario,
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.borda,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rotulo: {
    color: tema.textoSecundario,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    paddingHorizontal: 14,
    // Alvo de toque confortável no celular; no PC vira uma caixa normal.
    minHeight: 48,
    paddingVertical: 12,
    color: tema.texto,
    fontSize: 15,
  },
  erro: { color: tema.erro, fontSize: 13, fontWeight: '600', marginTop: 14 },
  botao: {
    marginTop: 22,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.primaria,
  },
  textoBotao: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  rodape: { color: tema.textoTerciario, fontSize: 11, lineHeight: 16, marginTop: 18 },
}));

export default TelaLogin;
