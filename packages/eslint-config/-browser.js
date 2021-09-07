const ts = require('./-ts');
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['ember', '@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:ember/recommended'],
  env: {
    browser: true,
    es6: true,
  },
  rules: {
    'no-restricted-globals': [2, 'find'],
    'keyword-spacing': [2],
    'no-constant-condition': ['error', { checkLoops: false }],

    'prettier/prettier': 'error',
  },
  overrides: [
    Object.assign({}, ts, {
      files: ['**/*.ts'],
    }),
  ],
};
