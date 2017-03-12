const Change = require('@cardstack/git/change');
const temp = require('@cardstack/data-source/tests/temp-helper');
const GitIndexer = require('@cardstack/git/indexer');
const Indexers = require('@cardstack/server/indexers');
const { commitOpts, makeRepo } = require('./support');
const ElasticAssert = require('@cardstack/elasticsearch/tests/assertions');

describe('git/indexer', function() {
  let root, indexer, ea;

  beforeEach(async function() {
    ea = new ElasticAssert();
    root = await temp.mkdir('cardstack-server-test');
    indexer = new Indexers([new GitIndexer({
      repoPath: root
    })]);
  });

  afterEach(async function() {
    await temp.cleanup();
    await ea.deleteAllIndices();
  });

  it('processes first empty branch', async function() {
    let { head } = await makeRepo(root);
    await indexer.update();
    let aliases = await ea.aliases();
    expect([...aliases.keys()]).to.deep.equal(['master']);
    let indices = await ea.indices();
    expect(indices).to.have.lengthOf(1);
    let indexerState = await ea.indexerState('master', 'git');
    expect(indexerState.commit).to.equal(head);
  });


  it('does not reindex when mapping definition is stable', async function() {
    let { repo, head } = await makeRepo(root);
    await indexer.update();
    let originalIndexName = (await ea.aliases()).get('master');
    let change = await Change.create(repo, head, 'master');
    let file = await change.get('contents/articles/hello-world.json', { allowCreate: true });
    file.setContent(JSON.stringify({
      hello: 'world'
    }));
    await change.finalize(commitOpts());
    await indexer.update();
    expect((await ea.aliases()).get('master')).to.equal(originalIndexName);
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
          'field-type': 'string'
        }
      }),
      'contents/articles/hello-world.json': JSON.stringify({
        attributes: {
          title: 'Hello world'
        }
      })
    });

    await indexer.update();
    let originalIndexName = (await ea.aliases()).get('master');

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('schema/fields/title.json', { allowUpdate: true });
    file.setContent(JSON.stringify({
      attributes: {
        'field-type': 'string',
        'searchable': false
      }
    }));
    await change.finalize(commitOpts());
    await indexer.update();
    expect((await ea.aliases()).get('master')).to.not.equal(originalIndexName);
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

    let indexerState = await ea.indexerState('master', 'git');
    expect(indexerState.commit).to.equal(head);

    let contents = await ea.documentContents('master', 'articles', 'hello-world');
    expect(contents).to.deep.equal({
      hello: 'world',
      cardstack_rel_names: [],
      cardstack_meta: { version: head }
    });
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

    let indexerState = await ea.indexerState('master', 'git');
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
