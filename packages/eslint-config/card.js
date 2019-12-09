const browser = require('./-browser');

module.exports = Object.assign({}, browser, {
  overrides: [
    // This loads our node rules
    Object.assign({}, require('./-node'), {
      // And applies them to all the paths that are node paths in a
      // standard card
      files: ['.eslintrc.js'],
    }),
  ],
});
