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
      },
    },
  ],
};
