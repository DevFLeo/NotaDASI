import type { Registro } from './registros';

/**
 * Mapeamento de cabeçalhos da planilha oficial da Prefeitura de Porto Velho
 * (Geo 360 / DASI / Estrutura Organizacional).
 */
const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
  departamento: ['departamento', 'orgao', 'secretaria'],
  setor: ['setor', 'divisao', 'unidade'],
  competencia: ['competencia', 'competenciaconformeregimento', 'atribuicao', 'descricao'],
  sistemaAtende: ['1osistemaatende', '1sistemaatende', 'osistemaatendeaatividade', 'sistemaatendeaatividade', 'sistemaatende'],
  comoAtende: ['2osistemaatende', '2sistemaatende', 'osistemaatendedequalforma', 'sistemaatendedequalforma', 'comoatende'],
  estruturadoNoSistema: ['3jaestaestruturado', '3ojaestaestruturado', 'jaestaestruturado', 'estruturadonosistema'],
  houveTreinamento: ['houvetreinamento', 'treinamento'],
  informacoesAcessadas: ['informacoesaseremacessadas', 'informacoesacessadas', 'camadas'],
  nivelAcessoCamada: ['niveldeacessoacamada', 'nivelacessocamada'],
  acessoCamadaConcedido: ['niveldeacessoacamadafoiconcedido', 'acessocamadaconcedido'],
  iniciouAtividade: ['iniciouaatividade', 'iniciouatividade'],
  moduloSig: ['modulodosig', 'modulosig', 'modulo'],
  nivelAcessoModulo: ['niveldeacessoaomodulo', 'nivelacessomodulo'],
  acessoModuloConcedido: ['niveldeacessoaomoduloconcedido', 'acessomoduloconcedido'],
  temProblema: ['temalgumproblema', 'temproblema', 'problema'],
  temChamado: ['temchamadoaberto', 'temchamado', 'chamado'],
  detalheProblema: ['detalheoproblema', 'detalheproblema'],
  observacao: ['observacao', 'observacoes', 'obs'],
  telefone: ['telefone', 'fone', 'contato', 'whatsapp', 'celular'],
  ramal: ['ramal', 'extensao'],
  email: ['email', 'correio', 'contatodireto'],
};

const normalizarChave = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const converterBooleano = (v: any): boolean | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = normalizarChave(String(v));
  if (['sim', 's', 'true', '1'].includes(s)) return true;
  if (['nao', 'n', 'false', '0'].includes(s)) return false;
  return undefined;
};

const extrairResponsavel = (textoSetor: string) => {
  let setor = textoSetor.trim();
  let responsavel = '';
  let cargo = '';

  const parenteses = setor.match(/\((.*?)\)$/);
  if (parenteses) {
    const miolo = parenteses[1].trim();
    setor = setor.replace(/\s*\(.*?\)$/, '').trim();

    const matchCargo = miolo.match(/^(Diretor(?:a)?|Gerente|Chefe|Coordenador(?:a)?|Assessor(?:a)?|Auditor(?:a)?)\s+(.*)$/i);
    if (matchCargo) {
      cargo = matchCargo[1].trim();
      responsavel = matchCargo[2].trim();
    } else {
      responsavel = miolo;
    }
  }

  // Sigla do setor (ex: "Divisão de Geoprocessamento - DGEO")
  let sigla = '';
  const matchSigla = setor.match(/[-–—]\s*([A-Z0-9/]+)$/);
  if (matchSigla) {
    sigla = matchSigla[1].trim();
  }

  return { setor, sigla, responsavel, cargo };
};

export function parseCSVouTSV(conteudo: string): Registro[] {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhas.length < 2) return [];

  // Detecta separador (tabulação, ponto-e-vírgula ou vírgula)
  const primeiraLinha = linhas[0];
  let sep = ',';
  if (primeiraLinha.includes('\t')) sep = '\t';
  else if (primeiraLinha.includes(';')) sep = ';';

  const quebrarLinha = (linha: string): string[] => {
    const res: string[] = [];
    let atual = '';
    let emAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        emAspas = !emAspas;
      } else if (c === sep && !emAspas) {
        res.push(atual.trim().replace(/^"|"$/g, ''));
        atual = '';
      } else {
        atual += c;
      }
    }
    res.push(atual.trim().replace(/^"|"$/g, ''));
    return res;
  };

  const cabecalhos = quebrarLinha(linhas[0]).map(normalizarChave);
  const mapaColunas: Record<string, number> = {};

  for (const [campo, aceitos] of Object.entries(MAPEAMENTO_COLUNAS)) {
    for (let idx = 0; idx < cabecalhos.length; idx++) {
      const col = cabecalhos[idx];
      if (col && aceitos.some((a) => col.startsWith(a) || a.startsWith(col))) {
        mapaColunas[campo] = idx;
        break;
      }
    }
  }

  const registros: Registro[] = [];
  let depAnterior = '';
  let depSiglaAnterior = '';
  let setorAnterior = '';
  let setorSiglaAnterior = '';
  let respAnterior = '';
  let cargoAnterior = '';

  for (let i = 1; i < linhas.length; i++) {
    const cols = quebrarLinha(linhas[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const obter = (campo: string) => {
      const idx = mapaColunas[campo];
      return idx !== undefined && idx < cols.length ? cols[idx].trim() : '';
    };

    let dep = obter('departamento');
    let setorBruto = obter('setor');
    const comp = obter('competencia');

    if (!comp && !setorBruto && !dep) continue;

    if (dep) {
      depAnterior = dep;
      const matchDepSigla = dep.match(/[-–—]\s*([A-Z0-9/]+)$/);
      depSiglaAnterior = matchDepSigla ? matchDepSigla[1] : dep.slice(0, 10).toUpperCase();
    } else {
      dep = depAnterior;
    }

    let siglaSetor = '';
    let responsavel = '';
    let cargo = '';

    if (setorBruto) {
      const extraido = extrairResponsavel(setorBruto);
      setorAnterior = extraido.setor;
      setorSiglaAnterior = extraido.sigla || extraido.setor.slice(0, 8).toUpperCase();
      respAnterior = extraido.responsavel;
      cargoAnterior = extraido.cargo;
    }

    setorBruto = setorAnterior;
    siglaSetor = setorSiglaAnterior;
    responsavel = respAnterior;
    cargo = cargoAnterior;

    const tel = obter('telefone');
    const ramal = obter('ramal');
    const email = obter('email');

    const id = `imp-${Date.now()}-${i}`;
    registros.push({
      id,
      departamento: dep,
      departamentoSigla: depSiglaAnterior,
      departamentoResponsavel: '',
      departamentoCargo: '',
      setor: setorBruto,
      setorSigla: siglaSetor,
      responsavel,
      cargo,
      competencia: comp || `Competência do setor ${siglaSetor || setorBruto}`,
      sistemaAtende: converterBooleano(obter('sistemaAtende')),
      comoAtende: obter('comoAtende'),
      estruturadoNoSistema: converterBooleano(obter('estruturadoNoSistema')),
      houveTreinamento: converterBooleano(obter('houveTreinamento')),
      informacoesAcessadas: obter('informacoesAcessadas'),
      nivelAcessoCamada: obter('nivelAcessoCamada'),
      acessoCamadaConcedido: converterBooleano(obter('acessoCamadaConcedido')),
      iniciouAtividade: converterBooleano(obter('iniciouAtividade')),
      moduloSig: obter('moduloSig'),
      nivelAcessoModulo: obter('nivelAcessoModulo'),
      acessoModuloConcedido: converterBooleano(obter('acessoModuloConcedido')),
      temProblema: converterBooleano(obter('temProblema')),
      temChamado: converterBooleano(obter('temChamado')),
      detalheProblema: obter('detalheProblema'),
      observacao: obter('observacao'),
      contatoInstitucional:
        tel || email || ramal
          ? {
              ...(tel ? { telefone: tel } : {}),
              ...(email ? { email } : {}),
              ...(ramal ? { ramal } : {}),
            }
          : undefined,
    });
  }

  return registros;
}

/** Descompacta dados deflate em texto sem bibliotecas externas */
async function inflarDeflate(dados: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(dados);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const resultado = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      resultado.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(resultado);
  }
  throw new Error('DecompressionStream não suportado neste navegador.');
}

/** Lê o diretório central de um arquivo ZIP (.xlsx) */
function lerZipCentralDirectory(buffer: Uint8Array) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Estrutura de arquivo compactado (.xlsx) inválida.');

  const cdOffset = view.getUint32(eocd + 16, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  let pos = cdOffset;
  const entries: Record<string, Uint8Array> = {};

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const nameBytes = buffer.subarray(pos + 46, pos + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compData = buffer.subarray(dataStart, dataStart + compSize);
    entries[name] = compData;

    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Lê diretamente um arquivo binário .xlsx da planilha municipal
 * e converte nas competências/registros do sistema.
 */
export async function parseXLSX(dadosBinarios: ArrayBuffer | Uint8Array): Promise<Registro[]> {
  const buffer = dadosBinarios instanceof Uint8Array ? dadosBinarios : new Uint8Array(dadosBinarios);
  const zip = lerZipCentralDirectory(buffer);

  if (!zip['xl/worksheets/sheet1.xml']) {
    throw new Error('Planilha sheet1.xml não encontrada dentro do arquivo XLSX.');
  }

  // 1. Shared Strings
  const strings: string[] = [];
  if (zip['xl/sharedStrings.xml']) {
    const sharedXml = await inflarDeflate(zip['xl/sharedStrings.xml']);
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let match: RegExpExecArray | null;
    while ((match = siRegex.exec(sharedXml)) !== null) {
      const textMatches = match[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = textMatches.map((t) => t.replace(/<\/?t[^>]*>/g, '')).join('');
      strings.push(
        text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'"),
      );
    }
  }

  // 2. Worksheet Sheet1
  const sheetXml = await inflarDeflate(zip['xl/worksheets/sheet1.xml']);
  const linhasMatriz: string[][] = [];

  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1];
    const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<is><t>([\s\S]*?)<\/t><\/is>|<v>([\s\S]*?)<\/v>)?<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    const linha: string[] = [];

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetter = cellMatch[1];
      const tipo = cellMatch[3];
      const inlineVal = cellMatch[4];
      const vVal = cellMatch[5];

      // Converte letras de coluna (A, B, ..., Z, AA, AB) para índice zero-based
      let colIdx = 0;
      for (let i = 0; i < colLetter.length; i++) {
        colIdx = colIdx * 26 + (colLetter.charCodeAt(i) - 64);
      }
      colIdx -= 1;

      let valor = '';
      if (tipo === 's' && vVal !== undefined) {
        const strIdx = parseInt(vVal, 10);
        valor = strings[strIdx] || '';
      } else if (inlineVal !== undefined) {
        valor = inlineVal;
      } else if (vVal !== undefined) {
        valor = vVal;
      }

      while (linha.length <= colIdx) {
        linha.push('');
      }
      linha[colIdx] = valor;
    }

    if (linha.length > 0 && linha.some((c) => Boolean(c && c.trim()))) {
      linhasMatriz.push(linha);
    }
  }

  if (linhasMatriz.length < 2) return [];

  // Converte a matriz de linhas para TSV e usa o pipeline padrão
  const tsv = linhasMatriz.map((l) => l.join('\t')).join('\n');
  return parseCSVouTSV(tsv);
}

/**
 * Lê qualquer formato suportado (JSON, CSV, TSV ou XLSX) e devolve registros
 */
export async function importarPlanilhaGenerica(
  conteudoOuBuffer: string | ArrayBuffer | Uint8Array,
  nomeArquivo: string = 'planilha.xlsx',
): Promise<Registro[]> {
  if (typeof conteudoOuBuffer === 'string') {
    const texto = conteudoOuBuffer.trim();
    if (texto.startsWith('[') || texto.startsWith('{')) {
      try {
        const json = JSON.parse(texto);
        if (Array.isArray(json)) return json as Registro[];
        if (Array.isArray(json.registros)) return json.registros as Registro[];
      } catch {
        // Se falhar o parse de JSON, tenta como CSV/TSV
      }
    }
    return parseCSVouTSV(texto);
  }

  // Se for binário (ArrayBuffer / Uint8Array)
  if (nomeArquivo.endsWith('.csv') || nomeArquivo.endsWith('.txt')) {
    const texto = new TextDecoder().decode(conteudoOuBuffer);
    return parseCSVouTSV(texto);
  }

  return parseXLSX(conteudoOuBuffer);
}
