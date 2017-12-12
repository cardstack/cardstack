const path = require('path');
const lint = require('mocha-eslint');

module.exports = function() {
  lint([ path.join(process.cwd()) ], { timeout: 20000 });
};
