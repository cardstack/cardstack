const browser = require('./-browser');
const node = require('./-node');
const test = require('./-test');
const ts = require('./-ts');

module.exports = Object.assign({}, browser, {
  overrides: [
    // This loads our node rules
    Object.assign({}, node, {
      // And applies them to all the paths that are node paths in a
      // standard ember-addon
      files: ['index.js', 'testem.js', 'ember-cli-build.js', 'config/**/*.js', 'tests/dummy/config/**/*.js'],
      excludedFiles: ['app/**', 'addon/**', 'tests/dummy/app/**'],
    }),

    // And this loads our node tests rules
    Object.assign({}, test, {
      files: ['node-tests/**/*.js', 'node-tests/**/*.ts'],
    }),
    Object.assign({}, ts, {
      files: ['**/*.ts'],
    }),
  ],
});
