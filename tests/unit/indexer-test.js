const git = require('../../src/git');
const temp = require('../temp-helper');
const Indexer = require('../../src/indexer');
const { commitOpts } = require('../git-assertions');
const { inES } = require('../elastic-assertions');
const { Branch } = require('nodegit');

const elasticsearch = 'http://10.0.15.2:9200';

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
    let repo = await git.createEmptyRepo(root, commitOpts({
      message: 'First commit'
    }));
    let head = (await Branch.lookup(repo, 'master', Branch.BRANCH.LOCAL)).target().tostrS();
    await indexer.update();
    let aliases = await inES(elasticsearch).aliases();
    expect([...aliases.keys()]).to.deep.equal(['master']);
    let indices = await inES(elasticsearch).indices();
    expect(indices).to.have.lengthOf(1);
    let indexerState = await inES(elasticsearch).indexerState('master');
    expect(indexerState.commit).to.equal(head);
  });

  it('indexes newly added document', async function() {
    let repo = await git.createEmptyRepo(root, commitOpts({
      message: 'First commit'
    }));

    await indexer.update();

    let parentRef = await Branch.lookup(repo, 'master', Branch.BRANCH.LOCAL);
    let updatedContent = [
      {
        filename: 'contents/articles/hello-world.json',
        buffer: Buffer.from(JSON.stringify({
          hello: 'world'
        }), 'utf8')
      }
    ];
    let head = await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    await indexer.update();

    let indexerState = await inES(elasticsearch).indexerState('master');
    expect(indexerState.commit).to.equal(head);

    let contents = JSON.parse(await inES(elasticsearch).documentContents('master', 'articles', 'hello-world'));
    expect(contents).to.deep.equal({ hello: 'world' });
  });

});
