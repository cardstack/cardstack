const lint = require('mocha-eslint');
const path = require('path');

lint([
  path.join(__dirname, '..', '..', '*')
]);
