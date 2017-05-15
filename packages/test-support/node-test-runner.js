const lint = require('mocha-eslint');
const glob = require('glob');
const path = require('path');

let patterns = [
  'packages/*/node-tests/**/*-test.js',
  'node-tests/**/*-test.js'
];
for (let pattern of patterns) {
  for (let file of glob.sync(pattern)) {
    require(process.cwd() + '/' + file);
  }
}

lint([ path.join(process.cwd()) ], { timeout: 20000 });
