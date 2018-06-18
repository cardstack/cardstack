const log = require('@cardstack/logger')('cardstack/pgsearch');
const Error = require('@cardstack/plugin-utils/error');

module.exports = class Searcher {
  constructor() {
    log.debug("constructed pgsearch searcher");
   }

  async get(/*session, branch, type, id */) {
    throw new Error("Unimplemented");
  }

  async search(/*session, branch, { queryString, filter, sort, page } */) {
    throw new Error("Unimplemented");
  }
 
};
