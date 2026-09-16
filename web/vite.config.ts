import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const raizProjeto = fileURLToPath(new URL('..', import.meta.url));

/**
 * A versao web reaproveita os MESMOS dados do app mobile: os arquivos
 * ../src/data/*.ts sao importados direto daqui, entao o Vite precisa ter
 * permissao de ler fora da pasta web/.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    fs: { allow: [raizProjeto] },
  },
});
