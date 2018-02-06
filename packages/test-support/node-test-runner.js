const glob = require('glob');
const requireUncached = require('require-uncached');
const prepare = require('./prepare-node-tests');
const lint = require('./node-lint-runner');


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

  lint();
};
