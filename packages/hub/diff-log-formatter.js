const logger = require('@cardstack/plugin-utils/logger');
const jsondiffpatch = require('jsondiffpatch').create();

logger.registerFormatter('p', format);

function format(v) {
  if (!v) {
    return '[invalid input to diff-log-formatter]';
  }
  return JSON.stringify(jsondiffpatch.diff(v.left, v.right));
}
