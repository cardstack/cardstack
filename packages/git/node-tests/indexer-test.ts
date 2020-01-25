import Change from '../change';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const temp = require('@cardstack/test-support/temp-helper');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env'); // eslint-disable-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports

import { commitOpts, makeRepo } from './support';

import logger from '@cardstack/logger';

import fs from 'fs';
import { join } from 'path';
import { todo } from '@cardstack/plugin-utils/todo-any';

function toResource(doc: todo) {
  return doc.data;
}

function internalCardDocument(titleValue: string, id = 'local-hub::test-card') {
  let factory = new JSONAPIFactory();
  return factory.getDocumentFor(
    factory
      .addResource(id, id)
      .withRelated('adopted-from', { type: 'local-hub::@cardstack/base-card', id: 'local-hub::@cardstack/base-card' })
      .withRelated('fields', [
        factory.addResource('fields', `${id}::title`).withAttributes({
          'is-metadata': true,
          'field-type': '@cardstack/core-types::string',
          'needed-when-embedded': true,
        }),
      ])
      .withAttributes({
        [`${id}::title`]: titleValue,
      })
  );
}

describe('git/indexer', function() {
  this.timeout(10000);

  let root: string,
    env: todo,
    indexer: todo,
    searcher: todo,
    cardServices: todo,
    dataSource: todo,
    assertNoDocument: Function,
    assertNoCard: Function,
    start: Function,
    client: todo;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      'card-types': ['local-hub::@cardstack/base-card'],
      params: { repo: root },
    });

    factory
      .addResource('content-types', 'articles')
      .withAttributes({
        defaultIncludes: ['author'],
      })
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
        factory.addResource('fields', 'author').withAttributes({
          fieldType: '@cardstack/core-types::belongs-to',
        }),
      ])
      .withRelated('data-source', dataSource);

    factory
      .addResource('content-types', 'people')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ])
      .withRelated('data-source', dataSource);

    start = async function() {
      env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
      indexer = env.lookup('hub:indexers');
      searcher = env.lookup('hub:searchers');
      cardServices = env.lookup('hub:card-services');
      client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      await cardServices._setupPromise;
    };

    assertNoDocument = async function(type: string, id: string) {
      try {
        await searcher.get(env.session, 'local-hub', type, id);
      } catch (err) {
        expect(err.status).to.equal(404);
        return;
      }
      throw new Error(`expected not to find document type=${type} id=${id}`);
    };

    assertNoCard = async function(id: string) {
      try {
        await cardServices.get(env.session, id, 'isolated');
      } catch (err) {
        expect(err.status).to.equal(404);
        return;
      }
      throw new Error(`expected not to find card document id=${id}`);
    };
  });

  afterEach(async function() {
    await temp.cleanup();
    await cardServices._setupPromise;
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
    file.setContent(
      JSON.stringify({
        attributes: { title: 'world' },
      })
    );
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'world');
  });

  it('indexes newly added card document', async function() {
    let { repo, head } = await makeRepo(root);

    await start();

    let internalCard = internalCardDocument('world');
    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${internalCard.data.id}.json`, { allowCreate: true });
    file.setContent(JSON.stringify(internalCard));
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await cardServices.get(env.session, internalCard.data.id, 'isolated');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'world');
  });

  it.skip("does not index card document from data source whose adoption chain does not match data source's card types", async function() {});

  it('ignores newly added document that lacks json extension', async function() {
    let { repo, head } = await makeRepo(root);

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world', { allowCreate: true });
    file.setContent(
      JSON.stringify({
        attributes: { title: 'world' },
      })
    );
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);
    await assertNoDocument('articles', 'hello-world');
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
    await assertNoDocument('articles', 'hello-world');
  });

  it('does not reindex unchanged content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: { title: 'world' },
      }),
    });

    await start();

    // Here we manually reach into postgres to dirty a cached
    // document in order to see whether the indexer will leave it
    // alone
    let row = await client.query(`select pristine_doc from documents where type=$1 and id=$2`, [
      'articles',
      'hello-world',
    ]);
    let editedDoc = Object.assign({}, row.rows[0].pristine_doc);
    editedDoc.data.attributes.title = 'somebody else';
    await client.query(`update documents set pristine_doc=$1 where type=$2 and id=$3`, [
      editedDoc,
      'articles',
      'hello-world',
    ]);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/second.json', { allowCreate: true });
    file.setContent(
      JSON.stringify({
        attributes: { title: 'world' },
      })
    );
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    expect(contents).to.have.deep.property('data.attributes.title', 'somebody else');
  });

  it('does not reindex unchanged card document', async function() {
    let internalCard = internalCardDocument('world');
    let { repo, head } = await makeRepo(root, {
      [`cards/${internalCard.data.id}.json`]: JSON.stringify(internalCard),
    });

    await start();

    // Here we manually reach into postgres to dirty a cached
    // document in order to see whether the indexer will leave it
    // alone
    let row = await client.query(`select pristine_doc from documents where type=$1 and id=$2`, [
      internalCard.data.id,
      internalCard.data.id,
    ]);
    let editedDoc = Object.assign({}, row.rows[0].pristine_doc);
    editedDoc.data.attributes[`${internalCard.data.id}::title`] = 'somebody else';

    await client.query(`update documents set pristine_doc=$1 where type=$2 and id=$3`, [
      editedDoc,
      internalCard.data.id,
      internalCard.data.id,
    ]);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/second.json', { allowCreate: true });
    file.setContent(
      JSON.stringify({
        attributes: { title: 'world' },
      })
    );
    head = await change.finalize(commitOpts());

    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal(head);

    let contents = await cardServices.get(env.session, internalCard.data.id, 'isolated');
    expect(contents).to.have.deep.property('data.attributes.title', 'somebody else');
  });

  it('deletes removed content', async function() {
    let { repo, head } = await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        title: 'world',
      }),
    });

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json');
    file.delete();
    await change.finalize(commitOpts());
    await indexer.update();
    await assertNoDocument('articles', 'hello-world');
  });

  it('deletes removed card document', async function() {
    let internalCard = internalCardDocument('world');
    let { repo, head } = await makeRepo(root, {
      [`cards/${internalCard.data.id}.json`]: JSON.stringify(internalCard),
    });

    await start();

    let change = await Change.create(repo, head, 'master');
    let file = await change.get(`cards/${internalCard.data.id}.json`);
    file.delete();
    await change.finalize(commitOpts());
    await indexer.update();
    await assertNoCard(internalCard.data.id);
  });

  it('replaces unrelated content it finds in the search index', async function() {
    let repos = await temp.mkdir('extra-repos');

    await makeRepo(repos + '/left', {
      'contents/articles/left.json': JSON.stringify({
        attributes: {
          title: 'article from left repo',
        },
      }),
      'contents/articles/both.json': JSON.stringify({
        attributes: {
          title: 'article from both repos, left version',
        },
      }),
    });

    await makeRepo(repos + '/right', {
      'contents/articles/right.json': JSON.stringify({
        attributes: {
          title: 'article from right repo',
        },
      }),
      'contents/articles/both.json': JSON.stringify({
        attributes: {
          title: 'article from both repos, right version',
        },
      }),
    });

    let { repo, head } = await makeRepo(root, {
      'contents/articles/upstream.json': JSON.stringify({
        attributes: {
          title: 'article from upstream',
        },
      }),
      'schema/data-sources/under-test.json': JSON.stringify({
        attributes: {
          'source-type': '@cardstack/git',
          params: { repo: repos + '/left' },
        },
      }),
    });

    await start();

    {
      let both = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'both'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, left version');

      let left = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'left'));
      expect(left).has.deep.property('attributes.title', 'article from left repo');

      let upstream = toResource(await searcher.get(env.session, 'local-hub', 'articles', 'upstream'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      await assertNoDocument('articles', 'right');
    }

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('schema/data-sources/under-test.json', { allowUpdate: true });
    file.setContent(
      JSON.stringify({
        attributes: {
          'source-type': '@cardstack/git',
          params: { repo: repos + '/right' },
        },
      })
    );
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
      await assertNoDocument('articles', 'left');
    }
  });

  it('replaces unrelated card content it finds in the search index', async function() {
    this.timeout(10000);
    let repos = await temp.mkdir('extra-repos');

    await makeRepo(repos + '/left', {
      'cards/local-hub::left.json': JSON.stringify(internalCardDocument('article from left repo', 'local-hub::left')),
      'cards/local-hub::both.json': JSON.stringify(
        internalCardDocument('article from both repos, left version', 'local-hub::both')
      ),
    });

    await makeRepo(repos + '/right', {
      'cards/local-hub::right.json': JSON.stringify(
        internalCardDocument('article from right repo', 'local-hub::right')
      ),
      'cards/local-hub::both.json': JSON.stringify(
        internalCardDocument('article from both repos, right version', 'local-hub::both')
      ),
    });

    let { repo, head } = await makeRepo(root, {
      'cards/local-hub::upstream.json': JSON.stringify(
        internalCardDocument('article from upstream', 'local-hub::upstream')
      ),
      'schema/data-sources/under-test.json': JSON.stringify({
        attributes: {
          'source-type': '@cardstack/git',
          'card-types': ['local-hub::@cardstack/base-card'],
          params: { repo: repos + '/left' },
        },
      }),
    });

    await start();

    {
      let both = toResource(await cardServices.get(env.session, 'local-hub::both', 'isolated'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, left version');

      let left = toResource(await cardServices.get(env.session, 'local-hub::left', 'isolated'));
      expect(left).has.deep.property('attributes.title', 'article from left repo');

      let upstream = toResource(await cardServices.get(env.session, 'local-hub::upstream', 'isolated'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      await assertNoCard('local-hub::right');
    }

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('schema/data-sources/under-test.json', { allowUpdate: true });
    file.setContent(
      JSON.stringify({
        attributes: {
          'source-type': '@cardstack/git',
          'card-types': ['local-hub::@cardstack/base-card'],
          params: { repo: repos + '/right' },
        },
      })
    );
    await change.finalize(commitOpts());

    await logger.expectWarn(/Unable to load previously indexed commit/, async () => {
      await indexer.update({ forceRefresh: true });
    });

    {
      // Update
      let both = toResource(await cardServices.get(env.session, 'local-hub::both', 'isolated'));
      expect(both).has.deep.property('attributes.title', 'article from both repos, right version');

      // Create
      let right = toResource(await cardServices.get(env.session, 'local-hub::right', 'isolated'));
      expect(right).has.deep.property('attributes.title', 'article from right repo');

      // Leave other data sources alone
      let upstream = toResource(await cardServices.get(env.session, 'local-hub::upstream', 'isolated'));
      expect(upstream).has.deep.property('attributes.title', 'article from upstream');

      // Delete
      await assertNoCard('local-hub::left');
    }
  });

  it('supports default-includes', async function() {
    await makeRepo(root, {
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: {
          title: 'Hello world',
        },
        relationships: {
          author: {
            data: { type: 'people', id: 'person1' },
          },
        },
      }),
      'contents/people/person1.json': JSON.stringify({
        attributes: {
          name: 'Q',
        },
      }),
    });

    await start();

    let contents = await searcher.get(env.session, 'local-hub', 'articles', 'hello-world');
    expect(contents).has.deep.property('included');
    expect(contents.included).has.length(1);
    expect(contents.included[0]).has.deep.property('attributes.name', 'Q');
  });
});

describe('git/indexer failures', function() {
  let root: string, env: todo;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');

    let factory = new JSONAPIFactory();

    let dataSource = factory.addResource('data-sources').withAttributes({
      'source-type': '@cardstack/git',
      params: { repo: root + '/repo-to-be-created' },
    });

    factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source', dataSource);
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
