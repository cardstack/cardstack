const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');
const temp = require('@cardstack/plugin-utils/node-tests/temp-helper');
const { makeRepo } = require('@cardstack/git/node-tests/support');
const GitIndexer = require('@cardstack/git/indexer');
const Indexers = require('@cardstack/server/indexers');
const GitWriter = require('@cardstack/git/writer');
const Writers = require('@cardstack/server/writers');
const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');

exports.createDefaultEnvironment = async function(initialModels = []) {
  let repoPath = await temp.mkdir('cardstack-server-test');

  // TODO: The git writer should make its own local repo when it
  // starts up the first time.
  let { head, repo } = await makeRepo(repoPath);


  // TODO: Instead of making this one-off writer, make SchemaCache
  // accept seed models so we can inject the first
  // data-source. Everything else can then be done through the regular
  // Writers.
  let writer = new GitWriter({ repo: repoPath });

  let user = {
    fullName: 'Default Test Environment',
    email: 'test@example.com'
  };

  let schemaCache = new SchemaCache();

  // TODO: we need Searchers as to Searcher as Writers is to Writer,
  // so we have a place to route special searches, and so we're not
  // hard-coding the @cardsatck/elasticsearch/searcher module
  // here. Should be data-driven instead.
  let searcher = new Searcher(schemaCache);
  let writers = new Writers(schemaCache);

  // TODO: Indexers should just take schemaCache and figure out its
  // own indexers list. Need to figure out how this plays with the
  // branches. In some cases, a "branch" exists because of
  // configuration on a data-source (like using different postgres
  // databases to represent "master" vs "production"). But in the git
  // case, the branches are discovered by the indexer and we have a
  // circular dependency to break.
  let indexer = new Indexers([new GitIndexer({
    repoPath
  })]);

  let pending = await writer.prepareCreate('master', user, 'data-sources', {
    type: 'data-sources',
    id: 'default-git',
    attributes: {
      'source-type': '@cardstack/git',
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
