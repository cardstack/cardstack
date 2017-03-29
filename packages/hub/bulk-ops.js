class BulkOps {
  constructor(es, { realTime, batchSize }) {
    this.es = es;
    this.queue = [];
    this.realTime = realTime;
    this.batchSize = batchSize || 1000;
  }

  async add(operation, ...source) {
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
    let response = await this.es.bulk({
      body,
      refresh: this.realTime
    });
    let failedOperations = response.items.filter(item => {
      let op = Object.keys(item)[0];
      return item[op].error;
    });
    if (failedOperations.length > 0) {
      throw new Error(`Some bulk operations failed: ${JSON.stringify(failedOperations)}`);
    }
  }
}

module.exports = BulkOps;
