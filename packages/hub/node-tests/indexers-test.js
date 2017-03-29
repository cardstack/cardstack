const Indexers = require('@cardstack/hub/indexers');
const SchemaCache = require('@cardstack/hub/schema-cache');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const Searcher = require('@cardstack/elasticsearch/searcher');
const { makeRepo } = require('@cardstack/git/node-tests/support');
const temp = require('@cardstack/plugin-utils/node-tests/temp-helper');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');

describe('server/indexers', function() {
  let repoPath, searcher;

  before(async function () {
    repoPath = await temp.mkdir('cardstack-server-test');
    await makeRepo(repoPath);
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/hub',
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

    let schemaCache = new SchemaCache(factory.getModels());
    let indexers = new Indexers(schemaCache);
    searcher = new Searcher(schemaCache);
    await indexers.update({realTime: true});
  });

  after(async function() {
    await temp.cleanup();
    let ea = new ElasticAssert();
    await ea.deleteAllIndices();
  });


  it("indexes seed models", async function() {
    let response = await searcher.search('master', { filter: { type: 'plugin-configs' }});
    expect(response.models.map(m => m.attributes.module)).includes('@cardstack/hub');
  });

  it("indexes bootstrap models", async function() {
    let response = await searcher.search('master', { filter: { type: 'plugin-configs' }});
    expect(response.models.map(m => m.attributes.module)).includes('@cardstack/core-types');
  });

});
