import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  aoResetar?: () => void;
  titulo?: string;
};

type State = {
  temErro: boolean;
  erro: Error | null;
};

export class LimiteDeErro extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { temErro: false, erro: null };
  }

  static getDerivedStateFromError(erro: Error): State {
    return { temErro: true, erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[LimiteDeErro] Erro capturado na árvore React:', erro, info);
    }
  }

  resetar = (): void => {
    this.setState({ temErro: false, erro: null });
    this.props.aoResetar?.();
  };

  render(): React.ReactNode {
    if (this.state.temErro) {
      return (
        <View style={estilos.container}>
          <View style={estilos.cartao}>
            <Text style={estilos.titulo}>
              {this.props.titulo || 'Ocorreu um erro nesta exibição'}
            </Text>
            <Text style={estilos.mensagem} numberOfLines={4}>
              {this.state.erro?.message || 'Falha inesperada ao renderizar o componente.'}
            </Text>
            <View style={estilos.acoes}>
              <Pressable
                onPress={this.resetar}
                style={estilos.botao}
                accessibilityRole="button">
                <Text style={estilos.textoBotao}>Fechar / Tentar Novamente</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  cartao: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  icone: {
    fontSize: 36,
    marginBottom: 12,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  mensagem: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  acoes: {
    flexDirection: 'row',
    gap: 12,
  },
  botao: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  textoBotao: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default LimiteDeErro;
