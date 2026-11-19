import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caminhoGerado = path.join(raiz, 'src', 'data', 'registros.gerado.ts');
const pastaLocal = path.join(raiz, 'dados', 'local');

if (!fs.existsSync(pastaLocal)) {
  fs.mkdirSync(pastaLocal, { recursive: true });
}

if (!fs.existsSync(caminhoGerado)) {
  const stub = [
    '/**',
    ' * Base local vazia (stub automatico).',
    ' * Este arquivo esta no .gitignore para que dados reais nao subam ao GitHub.',
    ' *',
    ' * Para carregar sua base exportada de outro PC:',
    ' *   npm run dados:importar dados/local/notadasi-dados.json',
    ' * ou importe o arquivo .json diretamente pela tela Ajustes -> Dados Locais.',
    ' */',
    "import type { Registro } from './registros';",
    '',
    'export const registrosImportados: Registro[] = [];',
    '',
  ].join('\n');

  fs.writeFileSync(caminhoGerado, stub, 'utf8');
  console.log('[NotaDASI] Stub local criado em src/data/registros.gerado.ts (base vazia — use npm run dados:importar ou Ajustes para importar).');
}
