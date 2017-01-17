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

  it('can fast-forward merge some new content', async function() {
    let path = `${root}/example`;

    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let id = (await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }))).success.id().tostrS();

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let head = await inRepo(path).getCommit('master');
    expect(head.message).to.equal('Second commit');

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');

  });


  it('non-fast-forward merge some new content', async function() {
    let path = `${root}/example`;
    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));
    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    updatedContent = [
      { filename: 'other.txt', buffer: Buffer.from('Non-conflicting content', 'utf8') }
    ];
    // This is based on the same parentRef as the second commit, so it's not a fast forward
    await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Third commit' }));

    expect((await inRepo(path).getCommit('master')).message).to.equal('Clean merge into master');
    expect((await inRepo(path).getCommit('master^1')).message).to.equal('Third commit');
    expect((await inRepo(path).getCommit('master^2')).message).to.equal('Second commit');
    expect(await inRepo(path).getContents('master', 'hello-world.txt')).to.equal('This is a file');
    expect(await inRepo(path).getContents('master', 'other.txt')).to.equal('Non-conflicting content');
  });

  it('rejects conflicting merge', async function() {
    let path = `${root}/example`;
    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));
    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    updatedContent = [
      { filename: 'hello-world.txt', buffer: Buffer.from('Conflicting content', 'utf8') }
    ];
    let result = await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Third commit' }));
    expect(result.conflict).to.not.equal(undefined);
    expect((await inRepo(path).getCommit('master')).message).to.equal('Second commit');
    expect(await inRepo(path).getContents('master', 'hello-world.txt')).to.equal('This is a file');
    let listing = await inRepo(path).listTree('master', '');
    expect(listing.length).to.equal(1);
    expect(listing[0].name).to.equal('hello-world.txt');
  });

  it('can add new directories', async function() {
    let path = `${root}/example`;

    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'outer/inner/hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let id = (await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }))).success.id().tostrS();

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let head = await inRepo(path).getCommit('master');
    expect(head.message).to.equal('Second commit');

    expect(await inRepo(path).getContents(id, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });




});
