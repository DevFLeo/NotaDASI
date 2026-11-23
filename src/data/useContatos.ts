import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Registro } from './registros';
import {
  combinarContatos,
  gerarIdContatoManual,
  type ContatoIntegrado,
  type NovoContatoManual,
} from './contatosIntegrados';

export const CHAVE_CONTATOS_MANUAIS = '@notadasi:contatos-manuais';

const limparOpcional = (valor?: string): string | undefined => {
  if (!valor) return undefined;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : undefined;
};

const lerManuais = async (): Promise<ContatoIntegrado[]> => {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_CONTATOS_MANUAIS);
    if (!bruto) return [];
    const parsed = JSON.parse(bruto);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const gravarManuais = (lista: ContatoIntegrado[]): void => {
  AsyncStorage.setItem(CHAVE_CONTATOS_MANUAIS, JSON.stringify(lista)).catch(() => {});
};

/**
 * Gerencia a aba de Contatos Institucionais integrada ao SIG:
 * - Contatos vindos do SIG (planilha, Excel importado ou cards) são extraídos
 *   automaticamente e sempre atualizados em tempo real.
 * - Contatos manuais adicionados na aba ficam persistidos no AsyncStorage e
 *   incluídos no backup portátil (.json).
 */
export function useContatos(registros: Registro[]) {
  const [manuais, setManuais] = useState<ContatoIntegrado[]>([]);

  useEffect(() => {
    let ativo = true;
    lerManuais().then((salvos) => {
      if (ativo) setManuais(salvos);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const contatos = useMemo(
    () => combinarContatos(registros, manuais),
    [registros, manuais],
  );

  const totalDoSig = useMemo(
    () => contatos.filter((c) => c.origem === 'sig').length,
    [contatos],
  );

  const totalManuais = manuais.length;

  const totalSemContato = useMemo(
    () => contatos.filter((c) => c.semContato).length,
    [contatos],
  );

  const criarContatoManual = useCallback((dados: NovoContatoManual): ContatoIntegrado => {
    const agora = new Date().toISOString();
    const email = limparOpcional(dados.email);
    const telefone = limparOpcional(dados.telefone);
    const ramal = limparOpcional(dados.ramal);
    const novo: ContatoIntegrado = {
      id: gerarIdContatoManual(),
      origem: 'manual',
      nome: dados.nome.trim() || 'Contato sem nome',
      cargo: (dados.cargo || '').trim(),
      secretaria: (dados.secretaria || 'GERAL').trim().toUpperCase(),
      departamento: (dados.departamento || dados.secretaria || 'Geral').trim(),
      setorSigla: (dados.setorSigla || '').trim().toUpperCase(),
      setor: (dados.setor || dados.setorSigla || 'Setor não informado').trim(),
      email,
      telefone,
      ramal,
      observacao: limparOpcional(dados.observacao),
      competenciasVinculadas: [],
      semContato: !email && !telefone && !ramal,
      criadoEm: agora,
      atualizadoEm: agora,
    };

    setManuais((atual) => {
      const proximo = [...atual, novo];
      gravarManuais(proximo);
      return proximo;
    });
    return novo;
  }, []);

  const atualizarContatoManual = useCallback((id: string, dados: NovoContatoManual) => {
    const agora = new Date().toISOString();
    const email = limparOpcional(dados.email);
    const telefone = limparOpcional(dados.telefone);
    const ramal = limparOpcional(dados.ramal);

    setManuais((atual) => {
      const proximo = atual.map((c) =>
        c.id === id
          ? {
              ...c,
              nome: dados.nome.trim() || c.nome,
              cargo: (dados.cargo ?? c.cargo).trim(),
              secretaria: (dados.secretaria || c.secretaria).trim().toUpperCase(),
              departamento: (dados.departamento || dados.secretaria || c.departamento).trim(),
              setorSigla: (dados.setorSigla ?? c.setorSigla).trim().toUpperCase(),
              setor: (dados.setor || dados.setorSigla || c.setor).trim(),
              email,
              telefone,
              ramal,
              observacao: limparOpcional(dados.observacao),
              semContato: !email && !telefone && !ramal,
              atualizadoEm: agora,
            }
          : c,
      );
      gravarManuais(proximo);
      return proximo;
    });
  }, []);

  const excluirContatoManual = useCallback((id: string) => {
    setManuais((atual) => {
      const proximo = atual.filter((c) => c.id !== id);
      gravarManuais(proximo);
      return proximo;
    });
  }, []);

  const limparContatosManuais = useCallback(() => {
    setManuais([]);
    AsyncStorage.removeItem(CHAVE_CONTATOS_MANUAIS).catch(() => {});
  }, []);

  return {
    contatos,
    totalContatos: contatos.length,
    totalDoSig,
    totalManuais,
    totalSemContato,
    criarContatoManual,
    atualizarContatoManual,
    excluirContatoManual,
    limparContatosManuais,
  };
}
