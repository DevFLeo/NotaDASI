import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ContatoProtegido from './ContatoProtegido';
import {
  calcularSituacao,
  corPorSituacao,
  rotuloSituacao,
  type Registro,
} from '../data/registros';

type Props = {
  registro: Registro | null;
  aoFechar: () => void;
};

const simNao = (valor?: boolean): string =>
  valor === true ? 'Sim' : valor === false ? 'Não' : '—';

const DetalheRegistro: React.FC<Props> = ({ registro, aoFechar }) => {
  if (!registro) {
    return null;
  }

  const situacao = calcularSituacao(registro);
  const cor = corPorSituacao[situacao];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.painel}>
          <View style={estilos.puxador} />

          <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
            <View style={[estilos.selo, { backgroundColor: `${cor}22` }]}>
              <Text style={[estilos.textoSelo, { color: cor }]}>{rotuloSituacao[situacao]}</Text>
            </View>

            <Text style={estilos.titulo}>{registro.competencia}</Text>

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
            {registro.comoAtende ? <Campo rotulo="De que forma" valor={registro.comoAtende} /> : null}
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
              <Campo rotulo="Detalhe" valor={registro.detalheProblema} />
            ) : null}
            {registro.observacao ? <Campo rotulo="Observação" valor={registro.observacao} /> : null}

            {registro.contatoInstitucional?.email || registro.contatoInstitucional?.telefone ? (
              <>
                <Secao titulo="Contato institucional" />
                {registro.contatoInstitucional.email ? (
                  <Text style={estilos.valor}>{registro.contatoInstitucional.email}</Text>
                ) : null}
                {registro.contatoInstitucional.telefone ? (
                  <Text style={estilos.valor}>{registro.contatoInstitucional.telefone}</Text>
                ) : null}
                {registro.contatoInstitucional.ramal ? (
                  <Text style={estilos.valor}>Ramal {registro.contatoInstitucional.ramal}</Text>
                ) : null}
              </>
            ) : null}

            <ContatoProtegido contato={registro.contatoPessoal} />
          </ScrollView>

          <Pressable onPress={aoFechar} style={estilos.botaoFechar}>
            <Text style={estilos.textoBotaoFechar}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const rotularUnidade = (sigla: string, nome: string): string =>
  [sigla, nome].filter(Boolean).join(' — ') || '—';

const Secao: React.FC<{ titulo: string }> = ({ titulo }) => (
  <Text style={estilos.secao}>{titulo}</Text>
);

const Campo: React.FC<{ rotulo: string; valor: string }> = ({ rotulo, valor }) => (
  <View style={estilos.bloco}>
    <Text style={estilos.rotulo}>{rotulo}</Text>
    <Text style={estilos.valor}>{valor}</Text>
  </View>
);

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.7)' },
  painel: {
    maxHeight: '88%',
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  puxador: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    marginBottom: 16,
  },
  conteudo: { paddingBottom: 16 },
  selo: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  textoSelo: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titulo: { color: '#f8fafc', fontSize: 17, fontWeight: '700', lineHeight: 24, marginBottom: 6 },
  secao: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginTop: 20,
    marginBottom: 2,
  },
  bloco: { marginTop: 10 },
  rotulo: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  valor: { color: '#e2e8f0', fontSize: 14, lineHeight: 21 },
  botaoFechar: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textoBotaoFechar: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
});

export default DetalheRegistro;
