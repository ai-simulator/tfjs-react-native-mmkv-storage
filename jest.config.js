/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'text-summary'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native-mmkv|react-native))',
  ],
};
