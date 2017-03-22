const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');
const temp = require('@cardstack/plugin-utils/node-tests/temp-helper');
const { makeRepo } = require('@cardstack/git/node-tests/support');
const GitIndexer = require('@cardstack/git/indexer');
const Indexers = require('@cardstack/server/indexers');
const Writers = require('@cardstack/server/writers');
const Schema = require('@cardstack/server/schema');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

exports.createDefaultEnvironment = async function(initialModels = []) {
  let repoPath = await temp.mkdir('cardstack-server-test');

  // TODO: The git writer should make its own local repo when it
  // starts up the first time.
  let { head, repo } = await makeRepo(repoPath);

  let user = {
    id: 'the-default-test-user',
    fullName: 'Default Test Environment',
    email: 'test@example.com'
  };

  let factory = new JSONAPIFactory();

  factory.addResource('plugin-configs')
    .withAttributes({
      module: '@cardstack/server',
    }).withRelated(
      'default-data-source',
      factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: { repo: repoPath }
        })
    );

  factory.addResource('plugin-configs')
    .withAttributes({ module: '@cardstack/git' });

  factory.addResource('grants')
    .withAttributes({
      groupId: 'the-default-test-user',
      mayCreateResource: true,
      mayUpdateResource: true,
      mayDeleteResource: true,
      mayWriteField: true
    });

  let schemaCache = new SchemaCache(factory.getModels());

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
  //
  // Solution: add some server-level config (probably in the
  // plugin-config for @cardstack/server) for the branch name that
  // always controls which indexers to run. This would also work for
  // branch-level grants: to create a branch, you must have a grant on
  // this specially-privileged branch.
  let indexer = new Indexers(schemaCache, [new GitIndexer({
    repoPath
  })]);

  // This creates the indices
  await indexer.update();

  for (let model of inDependencyOrder(initialModels)) {
    // TODO: this one-by-one creation is still slower than is nice for tests.
    let response = await writers.create('master', user, model.type, model);
    head = response.meta.version;
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
  let schemaCache = new SchemaCache();
  let indexers = new Indexers(schemaCache, [stub]);
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

function inDependencyOrder(models) {
  let priority = ['default-values', 'plugin-configs', 'constraints', 'fields', 'content-types'];
  return priority.map(type => models.filter(m => m.type === type)).reduce((a,b) => a.concat(b), []).concat(models.filter(m => !priority.includes(m.type)));
}
