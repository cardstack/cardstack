const denodeify = require('denodeify');
const git = require('../../src/git');
const ngit = require('nodegit');
const _temp = require('temp').track();
const temp = {
  mkdir: denodeify(_temp.mkdir),
  cleanup: denodeify(_temp.cleanup)
};
const inRepo = require('../git-assertions').inRepo;
const moment = require('moment-timezone');

function commitOpts(opts) {
  return Object.assign({}, {
    authorName: 'John Milton',
    authorEmail: 'john@paradiselost.com'
  }, opts);
}

describe('git', function() {
  let root;

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test');
  });
  afterEach(async function() {
    await temp.cleanup();
  });

  it('can make new empty repo', async function() {
    let path = `${root}/example`;

    await git.createEmptyRepo(path, commitOpts({
      message: 'First commit',
      authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa')
    }));

    let commit = await inRepo(path).getCommit('master');
    expect(commit.authorName).to.equal('John Milton');
    expect(commit.authorEmail).to.equal('john@paradiselost.com');
    expect(commit.message).to.equal('First commit');
    expect(commit.authorDate).to.equal('2017-01-16T12:21:00+03:00');
  });

  it('can build a commit with some content', async function() {
    let path = `${root}/example`;

    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let ref = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);
    let updatedContent = [
      { filename: 'hello-world.txt', filemode: ngit.TreeEntry.FILEMODE.BLOB, buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let id = (await git.makeCommit(repo, ref.target(), updatedContent, commitOpts({ message: 'Second commit' }))).id().tostrS();

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');

  });

});
