const IndexerEngine = require('@cardstack/server/indexer-engine');

module.exports = async function addRecords(records) {
  let stub = new StubIndexer();
  let engine = new IndexerEngine([stub]);
  stub.records = records;
  await engine.update({ realTime: true });
};

class StubIndexer {
  constructor() {
    this.records = [];
  }
  async branches() {
    return ['master'];
  }
  async beginUpdate() {
    return new StubUpdater(this);
  }
}

class StubUpdater {
  constructor(source) {
    this.source = source;
    this.name = 'stub';
  }
  async mappings() {
    return {};
  }
  async run(meta, hints, ops) {
    for (let record of this.source.records) {
      await ops.save(record.type, record.id, record);
    }
  }
}
