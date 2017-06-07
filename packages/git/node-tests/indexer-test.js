const Change = require('../change');
const temp = require('@cardstack/test-support/temp-helper');
const { commitOpts, makeRepo } = require('./support');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const toJSONAPI = require('@cardstack/elasticsearch/to-jsonapi');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { Registry, Container } = require('@cardstack/di');
const logger = require('@cardstack/plugin-utils/logger');
const fs = require('fs');

describe('git/indexer', function() {
  let root, indexer, ea, dataSource;

  beforeEach(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/git'
      });

    dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: { repo: root }
        });

    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/hub',
      }).withRelated(
        'default-data-source',
        dataSource
      );

    let registry = new Registry();
    registry.register('config:seed-models', factory.getModels());
    registry.register('config:project', {
      path: `${__dirname}/..`,
      isTesting: true
    });
    indexer = new Container(registry).lookup('hub:indexers');
  });

  afterEach(async function() {
    await temp.cleanup();
    await ea.deleteContentIndices();
  });

  it('processes first empty branch', async function() {
    let { head } = await makeRepo(root);
    await indexer.update();
    let aliases = await ea.contentAliases();
    expect([...aliases.keys()]).to.deep.equal(['master']);
    let indices = await ea.contentIndices();
    expect(indices).to.have.lengthOf(1);
    let indexerState = await ea.indexerState('master', dataSource.id);
    expect(indexerState.commit).to.equal(head);
  });


  it('does not reindex when mapping definition is stable', async function() {
    let { repo, head } = await makeRepo(root, {
      'schema/content-types/articles.json': JSON.stringify({
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'sample-string' },
              { type: 'fields', id: 'sample-object' }
            ]
          }
        }
      }),
      'schema/fields/sample-string.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      }),
      'schema/fields/sample-object.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::object'
        }
      })
    });
    await indexer.update();
    let originalIndexName = (await ea.contentAliases()).get('master');
    expect(originalIndexName).ok;
    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: {
        'sample-string': 'world',
        'sapmle-object': { bar: 'baz' }
      }
    }));
    await change.finalize(commitOpts());
    await indexer.update();
    expect((await ea.contentAliases()).get('master')).to.equal(originalIndexName);
  });

  it('reindexes when mapping definition is changed', async function() {
    let { repo, head } = await makeRepo(root, {
      'schema/content-types/articles.json': JSON.stringify({
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' }
            ]
          }
        }
      }),
      'schema/fields/title.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      }),
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: {
          title: 'Hello world'
        }
      })
    });

    await indexer.update();
    let originalIndexName = (await ea.contentAliases()).get('master');

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('schema/fields/title.json', { allowUpdate: true });
    file.setContent(JSON.stringify({
      attributes: {
        'field-type': '@cardstack/core-types::string',
        'searchable': false
      }
    }));
    await change.finalize(commitOpts());
    await indexer.update();
    expect((await ea.contentAliases()).get('master')).to.not.equal(originalIndexName);
  });


  it('indexes newly added document', async function() {
    let { repo, head } = await makeRepo(root);

    await indexer.update();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { hello: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await ea.indexerState('master', dataSource.id);
    expect(indexerState.commit).to.equal(head);

    let contents = await ea.documentContents('master', 'articles', 'hello-world');
    let jsonapi = toJSONAPI('articles', contents);
    expect(jsonapi).has.deep.property('attributes.hello', 'world');
  });

  it('ignores newly added document that lacks json extension', async function() {
    let { repo, head } = await makeRepo(root);

    await indexer.update();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { hello: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await ea.indexerState('master', dataSource.id);
    expect(indexerState.commit).to.equal(head);

    try {
      await ea.documentContents('master', 'articles', 'hello-world');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.match(/not found/i);
    }
  });

  it('ignores newly added document with malformed json', async function() {
    let { repo, head } = await makeRepo(root);

    await indexer.update();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent('not json');
    head = await change.finalize(commitOpts());

    await logger.expectWarn(/Ignoring record with invalid json at contents\/articles\/hello-world.json/, async () => {
      await indexer.update();
    });

    let indexerState = await ea.indexerState('master', dataSource.id);
    expect(indexerState.commit).to.equal(head);

    try {
      await ea.documentContents('master', 'articles', 'hello-world');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.match(/not found/i);
    }
  });

  it('does not reindex unchanged content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        hello: 'world'
      })
    });

    await indexer.update();

    // Here we manually reach into elasticsearch to dirty a cached
    // document in order to see whether the indexer will leave it
    // alone
    await ea.putDocument('master', 'articles', 'hello-world', { original: true });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/second.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { hello: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await ea.indexerState('master', dataSource.id);
    expect(indexerState.commit).to.equal(head);

    let contents = await ea.documentContents('master', 'articles', 'hello-world');
    expect(contents).to.deep.equal({ original: true });
  });


  it('deletes removed content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        hello: 'world'
      })
    });

    await indexer.update();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json');
    file.delete();
    await change.finalize(commitOpts());
    await indexer.update();

    try {
      await ea.documentContents('master', 'articles', 'hello-world');
      throw new Error("should never get here");
    } catch(err) {
      expect(err.message).to.match(/not found/i);
    }
  });

});

describe('git/indexer failures', function() {
  let root, indexer, ea;

  beforeEach(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/git'
      });

    let dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: { repo: root + '/repo-to-be-created' }
        });

    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/hub',
      }).withRelated(
        'default-data-source',
        dataSource
      );

    let registry = new Registry();
    registry.register('config:seed-models', factory.getModels());
    registry.register('config:project', {
      path: `${__dirname}/..`,
      isTesting: true
    });
    indexer = new Container(registry).lookup('hub:indexers');
  });

  afterEach(async function() {
    await temp.cleanup();
    await ea.deleteContentIndices();
  });

  it("makes a repo if one doesn't already exist", async function() {
    await indexer.update();
    expect(fs.existsSync(root + '/repo-to-be-created')).is.ok;
  });
});
