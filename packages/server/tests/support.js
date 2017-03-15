const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');
const temp = require('@cardstack/plugin-utils/tests/temp-helper');
const { makeRepo } = require('@cardstack/git/tests/support');
const GitIndexer = require('@cardstack/git/indexer');
const Indexers = require('@cardstack/server/indexers');
const GitWriter = require('@cardstack/git/writer');
const Writers = require('@cardstack/server/writers');
const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');

exports.createDefaultEnvironment = async function(initialModels = []) {
  let repoPath = await temp.mkdir('cardstack-server-test');
  let { head, repo } = await makeRepo(repoPath);

  let writer = new GitWriter({ repo: repoPath });

  let user = {
    fullName: 'Default Test Environment',
    email: 'test@example.com'
  };

  let schemaCache = new SchemaCache();
  let searcher = new Searcher(schemaCache);
  let writers = new Writers(schemaCache);

  let indexer = new Indexers([new GitIndexer({
    repoPath
  })]);

  let pending = await writer.prepareCreate('master', user, 'data-sources', {
    type: 'data-sources',
    id: 'default-git',
    attributes: {
      'source-type': 'git',
      params: { repo: repoPath }
    }
  });
  await pending.finalize();

  for (let model of initialModels) {
    let pending = await writer.prepareCreate('master', user, model.type, model);
    head = (await pending.finalize()).version;
  }

  await indexer.update({ realTime: true });

  return {
    searcher,
    indexer,
    writers,
    user,
    schemaCache,
    head,
    repo,
    repoPath
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
  let indexers = new Indexers([stub]);
  let schemaTypes = Schema.ownTypes();
  for (let record of records) {
    if (schemaTypes.indexOf(record.type) >= 0) {
      stub.schemaRecords.push(record);
    }
    stub.records.push(record);
  }
  await indexers.update({ realTime: true });
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
