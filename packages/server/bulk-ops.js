class BulkOps {
  constructor(es, { realTime, batchSize }) {
    this.es = es;
    this.queue = [];
    this.realTime = realTime;
    this.batchSize = batchSize || 1000;
  }

  async add(operation, source) {
    this.queue.push(operation);
    if (source) {
      this.queue.push(source);
    }
    if (this.queue.length > this.batchSize) {
      await this.flush();
    }
  }

  async flush() {
    let body = this.queue;
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
