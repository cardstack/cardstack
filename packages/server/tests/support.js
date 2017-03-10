const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');
const temp = require('@cardstack/data-source/tests/temp-helper');
const { makeRepo } = require('@cardstack/git/tests/support');
const GitIndexer = require('@cardstack/git/indexer');
const IndexerEngine = require('@cardstack/server/indexer-engine');
const GitWriter = require('@cardstack/git/writer');

// todo: move add-records stuff into here and rationalize
const { deleteAllRecords } = require('@cardstack/server/tests/add-records');

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
  await deleteAllRecords();
  await temp.cleanup();
};
