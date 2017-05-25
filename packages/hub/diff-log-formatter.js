const createDebug = require('debug');
const jsondiffpatch = require('jsondiffpatch').create();

function format(v) {
  if (!v) {
    return '[invalid input to diff-log-formatter]';
  }
  return JSON.stringify(jsondiffpatch.diff(v.left, v.right));
}
format.isDiffLogFormatter = true;

if (createDebug.formatters.p && !createDebug.formatters.p.isDiffLogFormatter) {
  throw new Error("namespace collision in log formatters for %p");
}
createDebug.formatters.p = format;
