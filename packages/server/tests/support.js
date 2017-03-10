const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');
const temp = require('@cardstack/data-source/tests/temp-helper');
const { makeRepo } = require('@cardstack/git/tests/support');
const GitIndexer = require('@cardstack/git/indexer');
const IndexerEngine = require('@cardstack/server/indexer-engine');
const GitWriter = require('@cardstack/git/writer');
const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');

exports.createDefaultEnvironment = async function(initialModels = []) {
  let repo = await temp.mkdir('cardstack-server-test');
  await makeRepo(repo);

  let writer = new GitWriter({ repo });

  let user = {
    fullName: 'Default Test Environment',
    email: 'test@example.com'
  };

  let schemaCache = new SchemaCache();
  let searcher = new Searcher(schemaCache);

  let indexer = new IndexerEngine([new GitIndexer({
    repoPath: repo
  })]);

  await writer.create('master', user, 'data-sources', {
    type: 'data-sources',
    id: 'default-git',
    attributes: {
      'source-type': 'git',
      params: { repo }
    }
  });

  for (let model of initialModels) {
    await writer.create('master', user, model.type, model);
  }

  await indexer.update({ realTime: true });

  return {
    searcher,
    indexer,
    writer,
    user,
    schemaCache
  };
};

exports.destroyDefaultEnvironment = async function(/* env */) {
  await destroyIndices();
  await temp.cleanup();
};

exports.destroyIndices = destroyIndices;
async function destroyIndices() {
  let ea = new ElasticAssert();
  await ea.deleteAllIndices();
}

exports.indexRecords = async function(records) {
  let stub = new StubIndexer();
  let engine = new IndexerEngine([stub]);
  let schemaTypes = Schema.ownTypes();
  for (let record of records) {
    if (schemaTypes.indexOf(record.type) >= 0) {
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
