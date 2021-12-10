let node = require('./-node');
let test = require('./-test');

module.exports = Object.assign({}, node, {
  overrides: [
    Object.assign({}, test, {
      files: ['node-tests/**/*.js', 'node-tests/**/*.ts'],
    }),
    Object.assign({}, node, {
      files: ['*.json'],
      rules: {
        semi: 'off',
      },
    }),
  ],
});
