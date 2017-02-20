const git = require('@cardstack/server/git');
const temp = require('./temp-helper');
const Indexer = require('@cardstack/server/indexer');
const { commitOpts, makeRepo } = require('./git-assertions');
const { inES, host } = require('./elastic-assertions');
const elasticsearch = host();

describe('indexer', function() {
  let root, indexer;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');
    indexer = new Indexer({
      elasticsearch,
      repoPath: root
    });
  });

  afterEach(async function() {
    await temp.cleanup();
    await inES(elasticsearch).deleteAllIndices();
  });

  it('processes first empty branch', async function() {
    let { head } = await makeRepo(root);
    await indexer.update();
    let aliases = await inES(elasticsearch).aliases();
    expect([...aliases.keys()]).to.deep.equal(['master']);
    let indices = await inES(elasticsearch).indices();
    expect(indices).to.have.lengthOf(1);
    let indexerState = await inES(elasticsearch).indexerState('master');
    expect(indexerState.commit).to.equal(head);
  });


  it('does not reindex when mapping definition is stable', async function() {
    let { repo, head } = await makeRepo(root);

    await indexer.update();

    let originalIndexName = (await inES(elasticsearch).aliases()).get('master');

    let updatedContent = [
      {
        operation: 'create',
        filename: 'contents/articles/hello-world.json',
        buffer: Buffer.from(JSON.stringify({
          hello: 'world'
        }), 'utf8')
      }
    ];

    await git.mergeCommit(repo, head, 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    await indexer.update();

    expect((await inES(elasticsearch).aliases()).get('master')).to.equal(originalIndexName);
  });


  it('indexes newly added document', async function() {
    let { repo, head } = await makeRepo(root);

    await indexer.update();

    let updatedContent = [
      {
        operation: 'create',
        filename: 'contents/articles/hello-world.json',
        buffer: Buffer.from(JSON.stringify({
          hello: 'world'
        }), 'utf8')
      }
    ];

    head = await git.mergeCommit(repo, head, 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    await indexer.update();

    let indexerState = await inES(elasticsearch).indexerState('master');
    expect(indexerState.commit).to.equal(head);

    let contents = await inES(elasticsearch).documentContents('master', 'articles', 'hello-world');
    expect(contents).to.deep.equal({ hello: 'world' });
  });

  it('does not reindex unchanged content', async function() {
    let { repo, head } = await makeRepo(root, [
      {
        changes: [
          {
            operation: 'create',
            filename: 'contents/articles/hello-world.json',
            buffer: Buffer.from(JSON.stringify({
              hello: 'world'
            }), 'utf8')
          }
        ]
      }
    ]);

    await indexer.update();

    // Here we manually reach into elasticsearch to dirty a cached
    // document in order to see whether the indexer will leave it
    // alone
    await inES(elasticsearch).putDocument('master', 'articles', 'hello-world', { original: true });

    let updatedContent = [
      {
        operation: 'create',
        filename: 'contents/articles/second.json',
        buffer: Buffer.from(JSON.stringify({
          second: 'document'
        }), 'utf8')
      }
    ];
    await git.mergeCommit(repo, head, 'master', updatedContent, commitOpts({ message: 'Third commit' }));

    await indexer.update();

    let contents = await inES(elasticsearch).documentContents('master', 'articles', 'hello-world');
    expect(contents).to.deep.equal({ original: true });
  });


  it('deletes removed content', async function() {
    let { repo, head } = await makeRepo(root, [
      {
        changes: [
          {
            operation: 'create',
            filename: 'contents/articles/hello-world.json',
            buffer: Buffer.from(JSON.stringify({
              hello: 'world'
            }), 'utf8')
          }
        ]
      }
    ]);

    await indexer.update();

    let updatedContent = [
      {
        operation: 'delete',
        filename: 'contents/articles/hello-world.json'
      }
    ];
    await git.mergeCommit(repo, head, 'master', updatedContent, commitOpts({ message: 'deletion' }));

    await indexer.update();

    try {
      await inES(elasticsearch).documentContents('master', 'articles', 'hello-world');
      throw new Error("should never get here");
    } catch(err) {
      expect(err.message).to.match(/not found/i);
    }
  });

});
