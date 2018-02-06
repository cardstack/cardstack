const jsondiffpatch = require('jsondiffpatch').create();

module.exports = function format(v) {
  if (!v) {
    return '[invalid input to diff-log-formatter]';
  }
  return JSON.stringify(jsondiffpatch.diff(v.left, v.right));
};
