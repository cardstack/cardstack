const Funnel = require('broccoli-funnel');
const concat = require('broccoli-concat');

module.exports = function buildBranches(inputTree, { compiler }) {
  // TODO: this only builds master, it should build every directory
  // that's present in the input to allow multi-branch
  let branch = 'master';
  return concat(compiler(new Funnel(inputTree, { srcDir: branch })), {
    outputFile: `codegen/${branch}.js`,
    inputFiles: ['**/*.js'],
    allowNone: true
  });
};
