/*
const logger = require('@cardstack/plugin-utils/logger');
const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
*/

module.exports = class Writer {
  static create(params) {
    return new this(params);
  }
  constructor({ branches }) {
    this.branchConfig = branches;
  }

  async prepareCreate(/* branch, session, type, document, isSchema */) {

  }

  async prepareUpdate(/* branch, session, type, id, document, isSchema */) {

  }

  async prepareDelete(/* branch, session, version, type, id, isSchema */) {
  }
};
