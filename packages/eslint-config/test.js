module.exports = Object.assign({}, require('./-node'), {
  plugins: ['mocha'],
  globals: {
    describe: false,
    it: false,
    beforeEach: false,
    afterEach: false,
    before: false,
    after: false,
    expect: false,
  },
  rules: {
    'mocha/handle-done-callback': 'error',
    'mocha/no-exclusive-tests': 'error',
    'mocha/no-global-tests': 'error',
    'mocha/no-identical-title': 'error',
    'mocha/no-mocha-arrows': 'error',
    'mocha/no-nested-tests': 'error',
    'mocha/no-return-and-callback': 'error',
    'mocha/no-top-level-hooks': 'error',
  },
});
