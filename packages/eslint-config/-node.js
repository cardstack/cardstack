module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    browser: false,
    es2020: true,
  },
  // I'm doing this instead of `extends` so that this config module
  // can be used within override blocks of other config modules.
  rules: Object.assign(
    {},
    require('eslint-plugin-node').configs.recommended.rules,
    require('eslint/conf/eslint-recommended').rules,
    {
      'no-constant-condition': ['error', { checkLoops: false }],
      'require-yield': 0,
      semi: ['error', 'always'],
      'node/no-extraneous-require': [
        'error',
        {
          allowModules: [],
        },
      ],
      'node/no-extraneous-import': [
        'error',
        {
          allowModules: [],
          resolvePaths: ['..'],
        },
      ],
      'node/no-missing-require': ['error'],
      'no-undef': 'error',

      'prettier/prettier': 'error',
    }
  ),
  plugins: ['node', '@typescript-eslint', 'prettier'],
};
