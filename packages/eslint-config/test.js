module.exports = Object.assign({}, require('./index'), {
  globals: {
    describe: false,
    it: false,
    beforeEach: false,
    afterEach: false,
    before: false,
    after: false,
    expect: false
  }
});
