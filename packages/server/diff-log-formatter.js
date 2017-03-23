const createDebug = require('debug');
const jsondiffpatch = require('jsondiffpatch').create();

createDebug.formatters.p = (v) => {
  if (!v) {
    return '[invalid input to diff-log-formatter]';
  }
  return JSON.stringify(jsondiffpatch.diff(v.left, v.right));
};
