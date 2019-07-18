module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  plugins: ['ember'],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended'
  ],
  env: {
    browser: true,
    es6: true
  },
  rules: {
    'no-restricted-globals': [2, 'find'],
    'keyword-spacing': [2],
  }
};
