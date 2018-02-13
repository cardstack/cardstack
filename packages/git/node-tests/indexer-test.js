const Change = require('../change');
const temp = require('@cardstack/test-support/temp-helper');
const { commitOpts, makeRepo } = require('./support');
const ElasticAssert = require('@cardstack/elasticsearch/node-tests/assertions');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { Registry, Container } = require('@cardstack/di');
const logger = require('@cardstack/logger');
const fs = require('fs');

function toJSONAPI(doc) {
  return doc.cardstack_pristine.data;
}

describe('git/indexer', function() {
  let root, indexer, ea, dataSource;

  beforeEach(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: { repo: root }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    let registry = new Registry();
    registry.register('config:seed-models', factory.getModels());
    registry.register('config:project', {
      path: `${__dirname}/..`
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
    let jsonapi = toJSONAPI(contents);
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
    await ea.assertNoDocument('master', 'articles', 'hello-world');
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
    await ea.assertNoDocument('master', 'articles', 'hello-world');
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
    await ea.assertNoDocument('master', 'articles', 'hello-world');

  });

  it('replaces unrelated content it finds in the search index', async function() {
    let repos = await temp.mkdir('extra-repos');

    await makeRepo(repos + '/left', {
      'contents/articles/left.json': JSON.stringify({
        attributes: {
          title: 'article from left repo'
        }
      }),
      'contents/articles/both.json': JSON.stringify({
        attributes: {
          title: 'article from both repos, left version'
        }
      })
    });

    await makeRepo(repos + '/right', {
      'contents/articles/right.json': JSON.stringify({
        attributes: {
          title: 'article from right repo'
        }
      }),
      'contents/articles/both.json': JSON.stringify({
        attributes: {
          title: 'article from both repos, right version'
        }
      })
    });

    let { repo, head } = await makeRepo(root, {
      'contents/articles/upstream.json': JSON.stringify({
        attributes: {
          title: 'article from upstream'
        }
      }),
      'schema/data-sources/under-test.json': JSON.stringify({
        attributes: {
          'source-type': '@cardstack/git',
          params: { repo: repos + '/left' }
        }
      })
    });

    // TODO: this should only require one update cycle.
    await indexer.update();
    await indexer.update();

    {
      let both = toJSONAPI(await ea.documentContents('master', 'articles', 'both'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, left version');

      let left = toJSONAPI(await ea.documentContents('master', 'articles', 'left'));
      expect(left).has.deep.property('attributes.title', 'article from left repo');

      let upstream = toJSONAPI(await ea.documentContents('master', 'articles', 'upstream'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      await ea.assertNoDocument('master', 'articles', 'right');
    }

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('schema/data-sources/under-test.json', { allowUpdate: true });
    file.setContent(JSON.stringify({
      attributes: {
        'source-type': '@cardstack/git',
        params: { repo: repos + '/right' }
      }
    }));
    await change.finalize(commitOpts());

    await logger.expectWarn(/Unable to load previously indexed commit/, async () => {
      // TODO: should only take one cycle
      await indexer.update({ realTime: true });
      await indexer.update({ realTime: true });
    });


    {
      // Update
      let both = toJSONAPI(await ea.documentContents('master', 'articles', 'both'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, right version');

      // Create
      let right = toJSONAPI(await ea.documentContents('master', 'articles', 'right'));
      expect(right).has.deep.property('attributes.title', 'article from right repo');

      // Leave other data sources alone
      let upstream = toJSONAPI(await ea.documentContents('master', 'articles', 'upstream'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      // Delete
      await ea.assertNoDocument('master', 'articles', 'left');
    }
  });

  it('supports default-includes', async function() {
    await makeRepo(root, {
      'schema/content-types/articles.json': JSON.stringify({
        attributes: {
          'default-includes': ['author']
        },
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'title' },
              { type: 'fields', id: 'author' }
            ]
          }
        }
      }),
      'schema/content-types/people.json': JSON.stringify({
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'name' }
            ]
          }
        }
      }),
      'schema/fields/title.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      }),
      'schema/fields/author.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::belongs-to'
        }
      }),
      'schema/fields/name.json': JSON.stringify({
        attributes: {
          'field-type': '@cardstack/core-types::string'
        }
      }),
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: {
          title: 'Hello world'
        },
        relationships: {
          author: {
            data: { type: 'people', id: 'person1' }
          }
        }
      }),
      'contents/people/person1.json': JSON.stringify({
        attributes: {
          name: 'Q'
        }
      })
    });

    await indexer.update();

    let contents = await ea.documentContents('master', 'articles', 'hello-world');
    expect(contents).has.deep.property('author.name', 'Q');
  });


});

describe('git/indexer failures', function() {
  let root, indexer, ea;

  beforeEach(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    let dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: { repo: root + '/repo-to-be-created' }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    let registry = new Registry();
    registry.register('config:seed-models', factory.getModels());
    registry.register('config:project', {
      path: `${__dirname}/..`
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
