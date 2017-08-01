const logger = require('@cardstack/plugin-utils/logger');

module.exports = class Indexer {
  static create(params) { return new this(params); }

  constructor({ branches }) {
    this.branchConfig = branches;
    this.log = logger('postgresql');
  }

  async branches() {
    return Object.keys(this.branchConfig);
  }

  async beginUpdate(branch) {
    return new Updater(this.branchConfig[branch]);
  }
};

class Updater {
  constructor(config) {
    this.config = config;
  }

  async schema() {
    let models = [];
    return models;
  }

  async updateContent(meta, /* hints, ops */) {
    // await ops.save(type, id, document);
    return meta;
  }
}
