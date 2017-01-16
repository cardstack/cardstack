module.exports = {
  root: true,
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
    semi: ["error", "always"]
  },
  globals: {
    Promise: false
  }
};
