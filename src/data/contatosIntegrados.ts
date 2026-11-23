import type { Contato, Registro } from './registros';

export type OrigemContato = 'sig' | 'manual';

export type CompetenciaVinculada = {
  id: string;
  competencia: string;
  registro: Registro;
};

export type ContatoIntegrado = {
  id: string;
  origem: OrigemContato;
  nome: string;
  cargo: string;
  secretaria: string;
  departamento: string;
  setorSigla: string;
  setor: string;
  email?: string;
  telefone?: string;
  ramal?: string;
  observacao?: string;
  contatoPessoal?: Contato;
  /** IDs e competências do SIG vinculadas a este contato/setor. */
  competenciasVinculadas: CompetenciaVinculada[];
  /** Verdadeiro quando não há e-mail, telefone nem ramal institucional cadastrado. */
  semContato: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
};

export type NovoContatoManual = {
  nome: string;
  cargo?: string;
  secretaria: string;
  departamento?: string;
  setorSigla?: string;
  setor?: string;
  email?: string;
  telefone?: string;
  ramal?: string;
  observacao?: string;
};

const normalizarTexto = (valor?: string): string =>
  (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const limparOpcional = (valor?: string): string | undefined => {
  if (!valor) return undefined;
  const limpo = valor.trim();
  return limpo.length > 0 && limpo !== '-' && limpo !== '—' ? limpo : undefined;
};

export const gerarIdContatoManual = (): string =>
  `contato-manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Extrai e consolida automaticamente todos os contatos presentes nos registros
 * do SIG (planilha oficial, Excel importado ou cards criados manualmente).
 *
 * Agrupa por (Secretaria/Departamento + Setor + Responsável) para evitar
 * duplicações quando um mesmo setor possui várias competências no SIG.
 */
export const extrairContatosDoSig = (registros: Registro[]): ContatoIntegrado[] => {
  const mapa = new Map<string, ContatoIntegrado>();

  for (const registro of registros) {
    const secretaria = (registro.departamentoSigla || registro.departamento || 'SEM SECRETARIA').trim();
    const setorSigla = (registro.setorSigla || '').trim();
    const setor = (registro.setor || setorSigla || 'Setor não informado').trim();
    const nome = (
      registro.responsavel ||
      registro.departamentoResponsavel ||
      `Responsável ${setorSigla || secretaria}`
    ).trim();
    const cargo = (registro.cargo || registro.departamentoCargo || '').trim();

    const chave = [
      normalizarTexto(secretaria),
      normalizarTexto(setorSigla || setor),
      normalizarTexto(nome),
    ].join('|');

    const email = limparOpcional(registro.contatoInstitucional?.email);
    const telefone = limparOpcional(registro.contatoInstitucional?.telefone);
    const ramal = limparOpcional(registro.contatoInstitucional?.ramal);

    const existente = mapa.get(chave);
    if (existente) {
      if (!existente.email && email) existente.email = email;
      if (!existente.telefone && telefone) existente.telefone = telefone;
      if (!existente.ramal && ramal) existente.ramal = ramal;
      if (!existente.cargo && cargo) existente.cargo = cargo;
      if (!existente.contatoPessoal && registro.contatoPessoal) {
        existente.contatoPessoal = registro.contatoPessoal;
      }
      existente.competenciasVinculadas.push({
        id: registro.id,
        competencia: registro.competencia,
        registro,
      });
      existente.semContato = !existente.email && !existente.telefone && !existente.ramal;
    } else {
      const slug = chave.replace(/[^a-z0-9]+/g, '-').slice(0, 64);
      mapa.set(chave, {
        id: `sig-contato-${slug}`,
        origem: 'sig',
        nome,
        cargo,
        secretaria: secretaria.toUpperCase(),
        departamento: (registro.departamento || secretaria).trim(),
        setorSigla: setorSigla.toUpperCase(),
        setor,
        email,
        telefone,
        ramal,
        contatoPessoal: registro.contatoPessoal,
        competenciasVinculadas: [
          {
            id: registro.id,
            competencia: registro.competencia,
            registro,
          },
        ],
        semContato: !email && !telefone && !ramal,
      });
    }
  }

  return [...mapa.values()].sort((a, b) => {
    const cmpSec = a.secretaria.localeCompare(b.secretaria, 'pt-BR');
    if (cmpSec !== 0) return cmpSec;
    const cmpSetor = (a.setorSigla || a.setor).localeCompare(b.setorSigla || b.setor, 'pt-BR');
    if (cmpSetor !== 0) return cmpSetor;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
};

/**
 * Combina os contatos extraídos do SIG com os contatos manuais cadastrados
 * diretamente na aba de Contatos.
 */
export const combinarContatos = (
  registros: Registro[],
  manuais: ContatoIntegrado[],
): ContatoIntegrado[] => {
  const doSig = extrairContatosDoSig(registros);
  const normalizadosManuais: ContatoIntegrado[] = manuais.map((m) => ({
    ...m,
    origem: 'manual',
    competenciasVinculadas: m.competenciasVinculadas ?? [],
    semContato: !limparOpcional(m.email) && !limparOpcional(m.telefone) && !limparOpcional(m.ramal),
  }));

  return [...doSig, ...normalizadosManuais].sort((a, b) => {
    const cmpSec = a.secretaria.localeCompare(b.secretaria, 'pt-BR');
    if (cmpSec !== 0) return cmpSec;
    const cmpSetor = (a.setorSigla || a.setor).localeCompare(b.setorSigla || b.setor, 'pt-BR');
    if (cmpSetor !== 0) return cmpSetor;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
};

export const textoPesquisavelContato = (c: ContatoIntegrado): string =>
  [
    c.nome,
    c.cargo,
    c.secretaria,
    c.departamento,
    c.setorSigla,
    c.setor,
    c.email ?? '',
    c.telefone ?? '',
    c.ramal ?? '',
    c.observacao ?? '',
  ]
    .join(' ')
    .toLowerCase();
