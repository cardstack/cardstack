const lint = require('mocha-eslint');
const path = require('path');

lint([
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'tests')
]);
