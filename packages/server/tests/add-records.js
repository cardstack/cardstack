const IndexerEngine = require('@cardstack/server/indexer-engine');
const Searcher = require('@cardstack/elasticsearch/searcher');
const Schema = require('@cardstack/server/schema');
const Plugins = require('@cardstack/server/plugins');

module.exports = async function addRecords(records) {
  let plugins = await Plugins.load();
  let stub = new StubIndexer();
  let engine = new IndexerEngine([stub], new Searcher(), plugins);
  let schemaTypes = Schema.ownTypes();
  for (let record of records) {
    if (schemaTypes.indexOf(record.type)) {
      stub.schemaRecords.push(record);
    } else {
      stub.records.push(record);
    }
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
  async updateSchema(meta, hints, ops) {
    for (let record of this.source.schemaRecords) {
      await ops.save(record.type, record.id, record);
    }
  }
  async updateContent(meta, hints, ops) {
    for (let record of this.source.records) {
      await ops.save(record.type, record.id, record);
    }
  }
}
