import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { transformAsync } from '@babel/core';
import fs from 'node:fs';
import path from 'node:path';

// Este arquivo é .mts (ESM) de propósito: como .ts ele era carregado como
// CommonJS e o Vite avisava a cada execução que isso deixará de funcionar.
// Em ESM não existe __dirname, então a pasta vem de import.meta.dirname.
const pastaPc = import.meta.dirname;
const raizProjeto = path.resolve(pastaPc, '..');

/** Extensões web, na ordem de preferência — espelha a lista do resolve.extensions. */
const EXTENSOES_WEB = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js'];

/**
 * Replica a resolução por plataforma que o Metro faz nativamente.
 *
 * As bibliotecas do ecossistema React Native publicam variantes `.web.js` ao
 * lado do arquivo nativo (ex.: react-native-gesture-handler tem
 * `PressabilityDebugView.js` E `PressabilityDebugView.web.js`). O Metro sabe
 * escolher a segunda; o Vite não, e acaba carregando a nativa — que importa
 * caminhos internos do react-native (`react-native/Libraries/...`) que não
 * existem no react-native-web, quebrando o build.
 *
 * Este plugin resolve isso na origem: antes de qualquer outra coisa, para todo
 * import relativo, verifica se existe um irmão `.web.*` e prefere ele.
 *
 * ATENÇÃO: precisa ser registrado em DOIS lugares — em `plugins` (para o dev
 * server e o build) e em `optimizeDeps.rolldownOptions.plugins` (para o
 * pré-empacotador, que roda antes e não enxerga a lista de plugins normal).
 * Sem o segundo, o otimizador carrega as variantes nativas e o build morre nos
 * arquivos Flow do react-native.
 */
const resolverVariantesWeb = (): Plugin => ({
  name: 'nota-dasi:resolver-variantes-web',
  enforce: 'pre',

  resolveId(origem, importador) {
    if (!importador || !origem.startsWith('.')) {
      return null;
    }

    // Import já com extensão (./foo.js) vira ./foo — para testarmos ./foo.web.js
    const semExtensao = origem.replace(/\.[jt]sx?$/, '');
    const caminhoBase = path.resolve(path.dirname(importador), semExtensao);

    for (const extensao of EXTENSOES_WEB) {
      const candidato = caminhoBase + extensao;
      if (fs.existsSync(candidato)) {
        return candidato;
      }
    }

    return null;
  },
});

/**
 * Aplica o plugin Babel do react-native-worklets ao código do app.
 *
 * No Android isso sai de graça: o babel.config.js da raiz já lista
 * 'react-native-worklets/plugin' e o Metro o executa. Aqui não há Metro, e o
 * @vitejs/plugin-react 6 NÃO tem mais opção `babel` (o Vite 8 transforma com
 * oxc) — passar `babel: {...}` para ele é silenciosamente ignorado.
 *
 * Sem esta transformação o app monta e quebra na primeira tela com
 * "[Reanimated] `useAnimatedStyle` was used without a dependency array or
 * Babel plugin", porque o Reanimated depende do plugin para extrair as
 * funções marcadas 'worklet' e suas dependências.
 *
 * Roda com enforce: 'pre' para ver o TSX original, e usa apenas plugins de
 * SINTAXE (não presets) para que os tipos TypeScript e o JSX continuem no
 * código de saída — quem os remove, depois, é o oxc.
 */
const aplicarPluginDeWorklets = (): Plugin => ({
  name: 'nota-dasi:worklets-babel',
  enforce: 'pre',

  async transform(codigo, id) {
    const arquivo = id.split('?')[0];

    if (!/\.[jt]sx?$/.test(arquivo) || arquivo.includes('node_modules')) {
      return null;
    }

    // Babel não é barato: só passa por arquivos que realmente podem conter
    // worklets (gestos e animações), em vez de todo o src/.
    const podeTerWorklet =
      codigo.includes('react-native-reanimated') ||
      codigo.includes('react-native-gesture-handler') ||
      codigo.includes('worklet');

    if (!podeTerWorklet) {
      return null;
    }

    const resultado = await transformAsync(codigo, {
      filename: arquivo,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      plugins: [
        ['@babel/plugin-syntax-typescript', { isTSX: arquivo.endsWith('x') }],
        '@babel/plugin-syntax-jsx',
        'react-native-worklets/plugin',
      ],
    });

    if (!resultado?.code) {
      return null;
    }

    return { code: resultado.code, map: resultado.map };
  },
});

/**
 * Build do NotaDASI para o navegador (localhost), reaproveitando o código do
 * app Android sem duplicar nada.
 *
 * Rodar com: npm run dev
 */
export default defineConfig({
  root: pastaPc,

  plugins: [
    resolverVariantesWeb(),
    aplicarPluginDeWorklets(),
    react(),
  ],

  resolve: {
    alias: [
      // Só o import exato de 'react-native' vai para o shim. Caminhos profundos
      // (react-native/Libraries/...) NÃO são aliasados: o react-native-web tem
      // outro layout interno (dist/modules, dist/exports) e mapeá-los cegamente
      // gera erro de módulo inexistente. O plugin acima evita que esses imports
      // cheguem a ser avaliados, escolhendo a variante .web.
      { find: /^react-native$/, replacement: path.resolve(pastaPc, 'shims/react-native.ts') },

      // O react-native-svg importa este pacote interno do RN para resolver
      // <Image> dentro de SVG. Ele só existe no grafo do Metro e o app não usa
      // esse caminho — ver o comentário em shims/assets-registry.ts.
      {
        find: /^@react-native\/assets-registry\/registry$/,
        replacement: path.resolve(pastaPc, 'shims/assets-registry.ts'),
      },

      // Script CommonJS do Reanimated que o navegador não consegue importar
      // como ESM — ver o comentário em shims/validate-worklets-version.ts.
      {
        find: /^react-native-reanimated\/scripts\/validate-worklets-version$/,
        replacement: path.resolve(pastaPc, 'shims/validate-worklets-version.ts'),
      },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },

  define: {
    global: 'globalThis',
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },

  server: {
    port: 5173,
    // Deixa o Vite servir arquivos de fora de pc/ (App.tsx e src/ ficam na
    // raiz do projeto) — é o que permite compartilhar o mesmo código.
    fs: {
      allow: [raizProjeto],
    },
  },

  optimizeDeps: {
    /**
     * As libs do ecossistema RN PRECISAM passar pelo pré-empacotador.
     *
     * Metade delas (e das suas dependências: react-native-is-edge-to-edge,
     * os scripts internos do Reanimated) ainda é CommonJS, e é o optimizeDeps
     * que converte CJS → ESM. Tirá-las daqui parece inofensivo e quebra o app
     * no boot com "does not provide an export named ...".
     *
     * A resolução por plataforma (.web.js) continua correta porque o plugin
     * resolverVariantesWeb roda com enforce: 'pre', antes do pré-empacotador.
     */
    include: [
      'react-native-web',
      'react-dom/client',
      'react-native-gesture-handler',
      'react-native-reanimated',
      'react-native-svg',
      'react-native-safe-area-context',
      '@react-native-async-storage/async-storage',
    ],

    // O pré-empacotador tem sua própria passagem e não usa a lista `plugins`
    // acima — sem repetir o resolvedor aqui, ele carrega as variantes nativas.
    rolldownOptions: {
      plugins: [resolverVariantesWeb()],
    },
  },
});
