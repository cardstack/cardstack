module.exports = {
  root: true,
  extends: '@cardstack/eslint-config/browser',
  overrides: [{
    files: 'node-tests/**/*.js',
    rules: {
      'node/no-unpublished-require': ['error', {
        'allowModules': ['@cardstack/test-support'],
      }]
    }
  }]
};
