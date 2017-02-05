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
    await this.es.bulk({
      body,
      refresh: this.realTime ? 'wait_for' : false
    });
  }
}

module.exports = BulkOps;
