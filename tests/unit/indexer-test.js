const git = require('../../src/git');
const temp = require('../temp-helper');
const Indexer = require('../../src/indexer');
const { commitOpts } = require('../git-assertions');
const { inES } = require('../elastic-assertions');


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
    await git.createEmptyRepo(root, commitOpts({
      message: 'First commit'
    }));
    await indexer.update();
    let aliases = await inES(elasticsearch).aliases();
    expect([...aliases.keys()]).to.deep.equal(['master']);
    let indices = await inES(elasticsearch).indices();
    expect(indices).to.have.lengthOf(1);
  });
});
