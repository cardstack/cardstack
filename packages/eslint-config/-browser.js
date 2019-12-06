module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: ['ember', 'prettier'],
  extends: ['eslint:recommended', 'plugin:ember/recommended', 'prettier', 'prettier/@typescript-eslint'],
  env: {
    browser: true,
    es6: true,
  },
  rules: {
    'no-restricted-globals': [2, 'find'],
    'keyword-spacing': [2],

    'prettier/prettier': 'error',
  },
};
