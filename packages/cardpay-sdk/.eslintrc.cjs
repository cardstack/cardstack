module.exports = {
  root: true,
  extends: '@cardstack/eslint-config',
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/ban-types': [
          'error',
          {
            types: {
              TransactionReceipt:
                'Use SuccessfulTransactionReceipt for SDK return types. Unsuccessful transaction receipts should throw.',
            },
          },
        ],
      },
    },
  ],
};
