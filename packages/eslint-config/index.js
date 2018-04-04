let node = require('./-node');
let test = require('./test');

module.exports = Object.assign({}, node, {
  overrides: [
    Object.assign({}, test, {
      files: [
        'node-tests/**/*.js'
      ]
    })
  ]
});
