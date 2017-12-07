const lint = require('mocha-eslint');
const glob = require('glob');
const path = require('path');
const requireUncached = require('require-uncached');
const prepare = require('./prepare-node-tests');


module.exports = function() {
  let patterns = [
    'packages/*/node-tests/**/*-test.js',
    'node-tests/**/*-test.js'
  ];

  for (let pattern of patterns) {
    for (let file of glob.sync(pattern)) {
      if (process.platform === 'darwin' && /\bpackages\/git\b/.test(file)) {
        describe(`git ${file}`, function() {
          it.skip("These tests are skipped until I can fix nodegit on OSX High Sierra");
        });
        continue;
      }
      prepare();
      requireUncached(process.cwd() + '/' + file);
    }
  }

  lint([ path.join(process.cwd()) ], { timeout: 20000 });
};
