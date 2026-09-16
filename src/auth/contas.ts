/**
 * Contas de acesso do NotaDASI.
 *
 * O app é usado por mais de uma pessoa no mesmo aparelho (e agora também no
 * PC), então a entrada passa a pedir uma conta. Isso NÃO é uma barreira de
 * segurança — é uma identificação de quem está mexendo, e o alicerce para
 * quando o servidor de `db/schema.sql` existir e as alterações passarem a ter
 * autor.
 *
 * As contas ficam no MESMO armazenamento do resto do app (AsyncStorage: banco
 * do APK no Android, IndexedDB no navegador), pelas mesmas chaves nos dois
 * alvos. Ver `useSessao.tsx`.
 */

/** Papel da conta — hoje só rotula quem entrou; não restringe telas. */
export type PapelConta = 'dasi' | 'gerente' | 'secretario' | 'outro';

export type Conta = {
  /** O que se digita no login, já normalizado (ver `normalizarUsuario`). */
  usuario: string;
  /** Como o nome aparece na interface. */
  nome: string;
  papel: PapelConta;
  descricao: string;
  /** Ver `hashSenha` — guardar a senha em texto puro no localStorage seria pior. */
  senhaHash: string;
  /** Conta de fábrica: sempre recriada se sumir do armazenamento. */
  padrao: boolean;
  criadaEm: string;
};

/**
 * Normaliza o usuário digitado para comparação: sem acento, em maiúsculas e
 * com espaços colapsados. É o que faz "gerente - dgeo", "Gerente-DGEO" e
 * "GERENTE - DGEO" caírem todos na mesma conta — ninguém acerta o hífen e o
 * espaçamento de cabeça.
 */
export const normalizarUsuario = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, ' ')
    .trim();

/**
 * Hash de senha em JS puro (FNV-1a de 32 bits em duas passagens com sais
 * diferentes → 16 caracteres hex).
 *
 * ATENÇÃO, e isto é deliberado: **não é criptografia**. Não há bcrypt nem
 * WebCrypto aqui porque o app roda offline e o objetivo é apenas não deixar a
 * senha legível no armazenamento do aparelho. Quem tiver acesso ao aparelho e
 * a este código consegue reverter por força bruta — as senhas são curtas.
 *
 * Quando a autenticação for para o servidor, o hash de verdade é lá (com sal
 * por usuário e algoritmo lento). Esta função vira só o transporte.
 */
export const hashSenha = (senha: string): string => {
  const passagem = (texto: string, semente: number): string => {
    let hash = semente;
    for (let i = 0; i < texto.length; i += 1) {
      // O FNV-1a É definido em operações de bit — o lint avisa por hábito, mas
      // trocar o XOR por outra coisa faria disto um algoritmo diferente.
      // eslint-disable-next-line no-bitwise
      hash ^= texto.charCodeAt(i);
      // Multiplicação pelo primo 16777619 em aritmética de 32 bits.
      // eslint-disable-next-line no-bitwise
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };

  return passagem(`nd1:${senha}`, 0x811c9dc5) + passagem(`${senha}:nd2`, 0x01000193);
};

export const senhaConfere = (conta: Conta, senha: string): boolean =>
  conta.senhaHash === hashSenha(senha);

/**
 * As três contas que existem numa instalação nova, no celular e no PC.
 *
 * A senha inicial é o primeiro nome da conta em minúsculas (DASI → "dasi",
 * GERENTE - DGEO → "gerente", SECRETARIO → "secretario"). Isso é combinado,
 * não um descuido: o app é interno e a troca fica em Ajustes → Conta.
 */
export const CONTAS_PADRAO: Conta[] = [
  {
    usuario: 'DASI',
    nome: 'DASI',
    papel: 'dasi',
    descricao: 'Divisão de Análise de Sistemas de Informação',
    senhaHash: hashSenha('dasi'),
    padrao: true,
    criadaEm: '',
  },
  {
    usuario: 'GERENTE DGEO',
    nome: 'GERENTE - DGEO',
    papel: 'gerente',
    descricao: 'Gerência da Divisão de Geoprocessamento',
    senhaHash: hashSenha('gerente'),
    padrao: true,
    criadaEm: '',
  },
  {
    usuario: 'SECRETARIO',
    nome: 'SECRETARIO',
    papel: 'secretario',
    descricao: 'Secretaria — acompanhamento do levantamento',
    senhaHash: hashSenha('secretario'),
    padrao: true,
    criadaEm: '',
  },
];

/** Senha inicial de cada conta padrão — mostrada como dica na tela de entrada. */
export const SENHA_INICIAL: Record<string, string> = {
  DASI: 'dasi',
  'GERENTE DGEO': 'gerente',
  SECRETARIO: 'secretario',
};

export const acharConta = (contas: Conta[], usuario: string): Conta | undefined => {
  const alvo = normalizarUsuario(usuario);
  return contas.find((conta) => conta.usuario === alvo);
};

/**
 * Junta o que está salvo com as contas de fábrica.
 *
 * As padrão sempre voltam (com a senha que estiver salva, se houver): apagar o
 * armazenamento não pode trancar ninguém para fora do app. O que veio do disco
 * manda no resto — senha trocada, por exemplo.
 */
export const reconciliarContas = (salvas: Conta[]): Conta[] => {
  const porUsuario = new Map(salvas.map((conta) => [normalizarUsuario(conta.usuario), conta]));

  const padroes = CONTAS_PADRAO.map((padrao) => {
    const salva = porUsuario.get(padrao.usuario);
    porUsuario.delete(padrao.usuario);
    return salva ? { ...padrao, senhaHash: salva.senhaHash } : padrao;
  });

  return [...padroes, ...porUsuario.values()];
};
