const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    /**
     * Ignora as pastas de build nativo (Gradle e CMake).
     *
     * Sem isto, o watcher do Metro acompanha arquivos que o Gradle cria e apaga
     * durante o build Android e derruba o processo com ENOENT
     * ("watch ... android/build/intermediates/..."). Esses arquivos nunca fazem
     * parte do bundle JavaScript, entao nao ha motivo para observa-los.
     *
     * Cobre os dois casos reais:
     *   - qualquer pasta .cxx (fica em android/app/.cxx)
     *   - qualquer build sob android/ (android/build e android/app/build)
     *
     * O separador aceita tanto \ (Windows) quanto / (POSIX).
     */
    blockList: /([\\/]\.cxx[\\/])|([\\/]android[\\/](.*[\\/])?build[\\/])/,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
