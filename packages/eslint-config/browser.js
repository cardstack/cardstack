module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  extends: 'eslint:recommended',
  env: {
    browser: true
  },
  plugins: ['ember'],
  rules: {
    //'ember/no-old-shims': 'error',
    //'ember/new-module-imports': 'error',
    //'ember/avoid-leaking-state-in-components': 'error',
    'ember/no-side-effects': 'error'
  }
};
