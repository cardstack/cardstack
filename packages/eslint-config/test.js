module.exports = Object.assign({}, require('./-node'), {
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
