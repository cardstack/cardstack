module.exports = {
  parserOptions: {
    ecmaVersion: 8
  },
  env: {
    'node': true,
    'browser': false,
    'es6': true
  },
  // I'm doing this instead of `extends` so that this config module
  // can be used within override blocks of other config modules.
  rules: Object.assign({}, require('eslint-plugin-node').configs.recommended.rules, {
    'no-constant-condition': ["error", { checkLoops: false }],
    'require-yield': 0,
    'no-var': "error",
    semi: ["error", "always"],
    'node/no-extraneous-require': ['error', {
      'allowModules': []
    }],
    'node/no-missing-require': ['error']
  }),
  plugins: ['node']
};
