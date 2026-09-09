module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest/reanimatedMock.js',
  },
  setupFiles: [
    'react-native-safe-area-context/jest/mock',
    'react-native-gesture-handler/jestSetup',
    '<rootDir>/jest/setup.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-gesture-handler|react-native-svg|@react-native-async-storage)/)',
  ],
};
