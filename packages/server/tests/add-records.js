const IndexerEngine = require('@cardstack/server/indexer-engine');
const Schema = require('@cardstack/server/schema');

module.exports = async function addRecords(records) {
  let stub = new StubIndexer();
  let engine = new IndexerEngine([stub]);
  let schemaTypes = Schema.ownTypes();
  for (let record of records) {
    if (schemaTypes.indexOf(record.type)) {
      stub.schemaRecords.push(record);
    }
    stub.records.push(record);
  }
  await engine.update({ realTime: true });
};

class StubIndexer {
  constructor() {
    this.records = [];
    this.schemaRecords = [];
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
  async schema() {
    return this.source.schemaRecords.slice();
  }
  async updateContent(meta, hints, ops) {
    for (let record of this.source.records) {
      await ops.save(record.type, record.id, record);
    }
  }
}
