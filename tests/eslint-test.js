const lint = require('mocha-eslint');
const path = require('path');

lint([
  path.join(__dirname, '..', 'packages'),
  path.join(__dirname, '..', 'tests')
]);
