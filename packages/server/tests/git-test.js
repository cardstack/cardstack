const git = require('@cardstack/server/git');
const ngit = require('nodegit');
const temp = require('./temp-helper');
const {
  inRepo,
  commitOpts,
  makeRepo
}= require('./git-assertions');
const moment = require('moment-timezone');

describe('git', function() {
  let path;

  beforeEach(async function() {
    let root = await temp.mkdir('cardstack-server-test');
    path = `${root}/example`;
  });
  afterEach(async function() {
    await temp.cleanup();
  });

  it('can make new empty repo', async function() {

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
    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let id = (await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' })));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let head = await inRepo(path).getCommit('master');
    expect(head.message).to.equal('Second commit');

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');

  });


  it('non-fast-forward merge some new content', async function() {
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
    try {
      await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Third commit' }));
      throw new Error("merge was not supposed to succeed");
    } catch(err) {
      expect(err).instanceof(git.GitConflict);
    }

    expect((await inRepo(path).getCommit('master')).message).to.equal('Second commit');
    expect(await inRepo(path).getContents('master', 'hello-world.txt')).to.equal('This is a file');
    let listing = await inRepo(path).listTree('master', '');
    expect(listing.length).to.equal(1);
    expect(listing[0].name).to.equal('hello-world.txt');
  });

  it('can add new directories', async function() {
    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'outer/inner/hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let id = await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let head = await inRepo(path).getCommit('master');
    expect(head.message).to.equal('Second commit');

    expect(await inRepo(path).getContents(id, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });

  it('can add new file within directory', async function() {
    let repo = await git.createEmptyRepo(path, commitOpts({
      message: 'First commit'
    }));

    let parentRef = await ngit.Branch.lookup(repo, 'master', ngit.Branch.BRANCH.LOCAL);

    let updatedContent = [
      { filename: 'outer/inner/hello-world.txt', buffer: Buffer.from('This is a file', 'utf8') }
    ];
    let head = await git.mergeCommit(repo, parentRef.target(), 'master', updatedContent, commitOpts({ message: 'Second commit' }));

    updatedContent = [
      { filename: 'outer/inner/second.txt', buffer: Buffer.from('second file', 'utf8') }
    ];

    head = await git.mergeCommit(repo, head, 'master', updatedContent, commitOpts({ message: 'Third commit' }));

    expect(await inRepo(path).getContents(head, 'outer/inner/second.txt')).to.equal('second file');
    expect(await inRepo(path).getContents(head, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });

  it('can delete a file at the top level', async function() {
    let { repo, head } = await makeRepo(path, [
      {
        changes: [
          {
            filename: 'sample.txt',
            buffer: Buffer.from('sample', 'utf8')
          }
        ]
      }
    ]);

    let listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal(['sample.txt']);

    let updates = [
      {
        filename: 'sample.txt'
      }
    ];

    head = await git.mergeCommit(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);

  });

  it('can delete a file at an inner level', async function() {
    let { repo, head } = await makeRepo(path, [
      {
        changes: [
          {
            filename: 'outer/sample.txt',
            buffer: Buffer.from('sample', 'utf8')
          },
          {
            filename: 'outer/second.txt',
            buffer: Buffer.from('second', 'utf8')
          }
        ]
      }
    ]);

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');
    expect(listing).to.contain('second.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let updates = [
      {
        filename: 'outer/sample.txt'
      }
    ];

    head = await git.mergeCommit(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.deep.equal(['second.txt']);

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

  });

  it('can delete a whole subtree', async function() {
    let { repo, head } = await makeRepo(path, [
      {
        changes: [
          {
            filename: 'outer/sample.txt',
            buffer: Buffer.from('sample', 'utf8')
          }
        ]
      }
    ]);

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let updates = [
      {
        filename: 'outer/sample.txt'
      }
    ];

    head = await git.mergeCommit(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);
  });


});
