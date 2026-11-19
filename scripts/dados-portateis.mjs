import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caminhoGerado = path.join(raiz, 'src', 'data', 'registros.gerado.ts');
const pastaLocal = path.join(raiz, 'dados', 'local');
const caminhoPadrao = path.join(pastaLocal, 'notadasi-dados.json');

const acao = (process.argv[2] || '').toLowerCase();
const arquivoArg = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : caminhoPadrao;

const garantirPastaLocal = () => {
  if (!fs.existsSync(pastaLocal)) {
    fs.mkdirSync(pastaLocal, { recursive: true });
  }
};

const extrairRegistrosDeTs = (conteudoTs) => {
  // Remove import type e anotacao de tipo para avaliar o array JS puro em sandbox isolado
  const codigoJs = conteudoTs
    .replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, '')
    .replace(/export\s+const\s+registrosImportados\s*(?::\s*Registro\[\])?\s*=/, 'resultado =');

  const contexto = { resultado: [] };
  vm.createContext(contexto);
  vm.runInContext(codigoJs, contexto);
  if (!Array.isArray(contexto.resultado)) {
    throw new Error('Nao foi possivel extrair o array registrosImportados de src/data/registros.gerado.ts');
  }
  return contexto.resultado;
};

if (acao === 'exportar') {
  garantirPastaLocal();

  if (!fs.existsSync(caminhoGerado)) {
    console.error('[NotaDASI] Arquivo src/data/registros.gerado.ts nao encontrado.');
    process.exit(1);
  }

  const conteudo = fs.readFileSync(caminhoGerado, 'utf8');
  const registros = extrairRegistrosDeTs(conteudo);

  const pacote = {
    formato: 'notadasi-backup',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    origem: 'cli',
    totalRegistros: registros.length,
    registros,
  };

  fs.mkdirSync(path.dirname(arquivoArg), { recursive: true });
  fs.writeFileSync(arquivoArg, JSON.stringify(pacote, null, 2), 'utf8');

  console.log(`[NotaDASI] Exportacao concluida: ${registros.length} registros salvos em:`);
  console.log(`  ${arquivoArg}`);
  console.log('');
  console.log('Este arquivo fica fora do GitHub (ignorado no .gitignore).');
  console.log('Para usar no outro PC de desenvolvimento:');
  console.log('  1) Copie este arquivo para o outro PC (pendrive, Drive, rede local, etc.)');
  console.log('  2) Rode: npm run dados:importar <caminho-do-arquivo.json>');
  console.log('     ou importe diretamente pela tela Ajustes -> Dados Locais no navegador.');
} else if (acao === 'importar') {
  if (!fs.existsSync(arquivoArg)) {
    console.error(`[NotaDASI] Arquivo de backup nao encontrado: ${arquivoArg}`);
    console.error('Uso: npm run dados:importar [caminho/para/notadasi-dados.json]');
    process.exit(1);
  }

  const bruto = fs.readFileSync(arquivoArg, 'utf8');
  const parsed = JSON.parse(bruto);
  const registros = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.registros)
      ? parsed.registros
      : null;

  if (!registros) {
    console.error('[NotaDASI] Formato JSON invalido. Esperado um backup do NotaDASI com lista "registros".');
    process.exit(1);
  }

  const ts = [
    '/**',
    ' * BASE LOCAL IMPORTADA — ARQUIVO IGNORADO PELO GIT (.gitignore).',
    ` * Importado em: ${new Date().toISOString()}`,
    ` * Origem: ${path.basename(arquivoArg)} (${registros.length} registros)`,
    ' */',
    "import type { Registro } from './registros';",
    '',
    `export const registrosImportados: Registro[] = ${JSON.stringify(registros, null, 2)};`,
    '',
  ].join('\n');

  fs.writeFileSync(caminhoGerado, ts, 'utf8');
  console.log(`[NotaDASI] Importacao concluida: ${registros.length} registros carregados em src/data/registros.gerado.ts.`);
  console.log('Este arquivo esta no .gitignore e nao sera enviado ao GitHub.');
} else {
  console.log('Uso:');
  console.log('  npm run dados:exportar [arquivo-saida.json]');
  console.log('  npm run dados:importar [arquivo-entrada.json]');
  process.exit(1);
}
