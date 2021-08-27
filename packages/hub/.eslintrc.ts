module.exports = {
  root: true,
  extends: '@cardstack/eslint-config',
  rules: {
    'node/no-unpublished-require': [
      'error',
      {
        allowModules: ['dotenv'],
      },
    ],
  },
};
