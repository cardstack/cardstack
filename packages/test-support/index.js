// nothing else should come before this lines, because we're mangling
// environment variable that must be mangled before anything else
// causes require('debug').
const prepare = require('./prepare-node-tests');


const lint = require('mocha-eslint');
const glob = require('glob');
const path = require('path');
const requireUncached = require('require-uncached');


module.exports = function() {
  let patterns = [
    'packages/*/node-tests/**/*-test.js',
    'node-tests/**/*-test.js'
  ];

  for (let pattern of patterns) {
    for (let file of glob.sync(pattern)) {
      prepare();
      requireUncached(process.cwd() + '/' + file);
    }
  }

  lint([ path.join(process.cwd()) ], { timeout: 20000 });
};
