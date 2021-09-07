let node = require('./-node');
let test = require('./-test');
let ts = require('./-ts');

module.exports = Object.assign({}, node, {
  overrides: [
    Object.assign({}, test, {
      files: ['node-tests/**/*.js', 'node-tests/**/*.ts'],
    }),
    Object.assign({}, ts, {
      files: ['**/*.ts'],
      parserOptions: {
        project: ['./tsconfig.json'], // Specify it only for TypeScript files
      },
    }),
    Object.assign({}, node, {
      files: ['*.json'],
      rules: {
        semi: 'off',
      },
    }),
  ],
});
