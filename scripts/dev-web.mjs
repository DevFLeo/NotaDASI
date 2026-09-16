/**
 * `npm run dev` na raiz sobe a versao WEB do NotaDASI (pasta web/).
 *
 * Na primeira execucao as dependencias do Vite ainda nao existem, entao o
 * script instala sozinho antes de subir o servidor — assim `npm run dev`
 * funciona em maquina limpa sem passo extra.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaWeb = join(raiz, 'web');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * No Windows o npm e um .cmd e so roda via shell; passar a linha inteira como
 * string (em vez de comando + array) evita o aviso DEP0190 do Node.
 */
const rodar = (linha) =>
  new Promise((resolver, rejeitar) => {
    const processo = spawn(`${npm} ${linha}`, { cwd: pastaWeb, stdio: 'inherit', shell: true });
    processo.on('error', rejeitar);
    processo.on('exit', (codigo) =>
      codigo === 0 ? resolver() : rejeitar(new Error(`npm ${linha} saiu com código ${codigo}`)),
    );
  });

if (!existsSync(join(pastaWeb, 'node_modules'))) {
  console.log('> primeira execução: instalando as dependências da versão web...');
  await rodar('install --no-audit --no-fund');
}

const argumentosExtras = process.argv.slice(2);
await rodar(['run', 'dev', ...(argumentosExtras.length ? ['--', ...argumentosExtras] : [])].join(' '));
