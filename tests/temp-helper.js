const denodeify = require('denodeify');
const _temp = require('temp').track();
module.exports = {
  mkdir: denodeify(_temp.mkdir),
  cleanup: denodeify(_temp.cleanup)
};
