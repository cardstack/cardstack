const glob = require('glob');
const requireUncached = require('require-uncached');
const prepare = require('./prepare-node-tests');
const findDependencies = require('./lib/find-dependencies').default;

module.exports = function() {
  let patterns = [];

  for (let pkg of findDependencies('@cardstack/cardhost')) {
    patterns.push(`packages/${pkg.replace(/^@cardstack\//, '')}/node-tests/**/*-test.js`);
  }

  for (let pattern of patterns) {
    for (let file of glob.sync(pattern)) {
      prepare();
      requireUncached(process.cwd() + '/' + file);
    }
  }

};
