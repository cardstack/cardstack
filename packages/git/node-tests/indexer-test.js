const Change = require('../change');
const temp = require('@cardstack/test-support/temp-helper');
const { commitOpts, makeRepo } = require('./support');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const logger = require('@cardstack/logger');
const fs = require('fs');
const { join } = require('path');

function toResource(doc) {
  return doc.data;
}

describe('git/indexer', function() {
  let root, env, indexer, searcher, dataSource, assertNoDocument, start, client;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'articles')
      .withAttributes({
        defaultIncludes: ['author']
      })
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        factory.addResource('fields', 'author')
          .withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          })
      ]);

    factory.addResource('content-types', 'people')
      .withRelated('fields', [
        factory.addResource('fields', 'name')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          })
      ]);

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

    start = async function() {
      env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
      indexer = env.lookup('hub:indexers');
      searcher = env.lookup('hub:searchers');
      client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    };

    assertNoDocument = async function(version, type, id) {
      try {
        await searcher.get(env.session, 'local-hub', type, id, { version });
      } catch(err) {
        expect(err.status).to.equal(404);
        return;
      }
      throw new Error(`expected not to find document version=${version} type=${type} id=${id}`);
    };
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('processes first empty branch', async function() {
    let { head } = await makeRepo(root);
    await start();
    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);
  });

  it('indexes newly added document', async function() {
    let { repo, head } = await makeRepo(root);

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { title: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'world');
  });

  it('ignores newly added document that lacks json extension', async function() {
    let { repo, head } = await makeRepo(root);

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { title: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);
    await assertNoDocument('master', 'articles', 'hello-world');
  });

  it('ignores newly added document with malformed json', async function() {
    let { repo, head } = await makeRepo(root);

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent('{"attributes:{"title":"world"}}');
    head = await change.finalize(commitOpts());

    await logger.expectWarn(/Ignoring record with invalid json at contents\/articles\/hello-world.json/, async () => {
      await indexer.update();
    });

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);
    await assertNoDocument('master', 'articles', 'hello-world');
  });

  it('does not reindex unchanged content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: { title: 'world' }
      })
    });

    await start();

    // Here we manually reach into postgres to dirty a cached
    // document in order to see whether the indexer will leave it
    // alone
    let row = await client.query(`select pristine_doc from documents where branch=$1 and type=$2 and id=$3`, ['master', 'articles', 'hello-world']);
    let editedDoc = Object.assign({}, row.rows[0].pristine_doc);
    editedDoc.data.attributes.title = 'somebody else';
    await client.query(`update documents set pristine_doc=$1 where branch=$2 and type=$3 and id=$4`, [editedDoc, 'master', 'articles', 'hello-world']);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/second.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      attributes: { title: 'world' }
    }));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    expect(contents).to.have.deep.property('data.attributes.title', 'somebody else');
  });


  it('deletes removed content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        title: 'world'
      })
    });

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json');
    file.delete();
    await change.finalize(commitOpts());
    await indexer.update();
    await assertNoDocument('master', 'articles', 'hello-world');
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

    await start();

    {
      let both = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'both'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, left version');

      let left = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'left'));
      expect(left).has.deep.property('attributes.title', 'article from left repo');

      let upstream = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'upstream'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      await assertNoDocument('master', 'articles', 'right');
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
      await indexer.update({ forceRefresh: true });
    });


    {
      // Update
      let both = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'both'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, right version');

      // Create
      let right = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'right'));
      expect(right).has.deep.property('attributes.title', 'article from right repo');

      // Leave other data sources alone
      let upstream = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'upstream'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      // Delete
      await assertNoDocument('master', 'articles', 'left');
    }
  });

  it('supports default-includes', async function() {
    await makeRepo(root, {
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

    await start();

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    expect(contents).has.deep.property('included');
    expect(contents.included).has.length(1);
    expect(contents.included[0]).has.deep.property('attributes.name', 'Q');
  });


});

describe('git/indexer failures', function() {
  let root, env;

  beforeEach(async function() {
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
    env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it("makes a repo if one doesn't already exist", async function() {
    expect(fs.existsSync(root + '/repo-to-be-created')).is.ok;
  });
});
