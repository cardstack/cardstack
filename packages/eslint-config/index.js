module.exports = {
  parserOptions: {
    ecmaVersion: 8
  },
  extends: 'eslint:recommended',
  env: {
    'node': true
  },
  rules: {
    'no-constant-condition': ["error", { checkLoops: false }],
    'require-yield': 0,
    'no-var': "error",
    semi: ["error", "always"],
    'node/no-extraneous-require': ['error', {
      'allowModules': []
    }],
    'node/no-missing-require': ['error']

  },
  plugins: ['node'],
  globals: {
    Promise: false,
    Map: false,
    WeakMap: false,
    Symbol: false,
    Set: false
  }
};
