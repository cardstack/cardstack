const _ = require('lodash');

class BulkOps {
  constructor(es, { forceRefresh, batchSize }) {
    this.es = es;
    this.queue = [];

    // We always either wait for the next scheduled refresh or force
    // our own refresh. It's important that we never fire off an
    // operation that _doesn't_ wait for refresh at all (by setting
    // `refresh` to null or false), because those operations
    // effectively escape and even if you run a subsequent operation
    // that does wait, you get no guarantee that the escaped
    // operations have really finished.
    this.refresh = forceRefresh ? true : 'wait_for';

    this.batchSize = batchSize || 1000;
    this.queryDeletions = [];
  }

  async add(operation, ...source) {
    if (operation === 'deleteByQuery') {
      this.queryDeletions.push(source[0]);
      return;
    }
    this.queue.push(operation);
    if (source.length > 0) {
      this.queue.push(source[0] || {});
    }
    if (this.queue.length > this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    let body = this.queue;
    if (body.length === 0){ return; }
    this.queue = [];
    let response = await this.es.bulk({ body, refresh: this.refresh });
    let failedOperations = response.items.filter(item => {
      let op = Object.keys(item)[0];
      return item[op].error;
    });
    if (failedOperations.length > 0) {
      // to avoid massive log spam, we want to collate based on
      // repeating error messages and only log a few examples of each
      // problem if there are many instances.
      let ops = failedOperations.map(op => op[Object.keys(op)[0]]);
      let reasons = _.uniq(ops.map(op => op.error.reason)).map(reason => {
        let locations = ops.filter(op => op.error.reason === reason).map(op => `${op._type}/${op._id}`);
        return { reason, examples: locations.slice(0, 3) };
      });
      throw new Error(`Some bulk operations failed: ${JSON.stringify(reasons, null, 2)}`);
    }
  }

  async finalize() {
    await this.flush();
    await this._runQueryDeletions();
  }

  async _runQueryDeletions() {
    for (let query of this.queryDeletions) {
      query.refresh = this.refresh;
      await this.es.deleteByQuery(query);
    }
  }
}

module.exports = BulkOps;
