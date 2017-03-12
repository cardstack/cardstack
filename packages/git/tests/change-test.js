const Change = require('@cardstack/git/change');
const temp = require('@cardstack/data-source/tests/temp-helper');
const {
  inRepo,
  commitOpts,
  makeRepo
}= require('./support');
const moment = require('moment-timezone');

describe('git/change', function() {
  let path;

  beforeEach(async function() {
    let root = await temp.mkdir('cardstack-server-test');
    path = `${root}/example`;
  });
  afterEach(async function() {
    await temp.cleanup();
  });

  it('can make new empty repo', async function() {
    let change = await Change.createInitial(path, 'master');
    await change.finalize(commitOpts({
      message: 'First commit',
      authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa')
    }));

    let commit = await inRepo(path).getCommit('master');
    expect(commit.authorName).to.equal('John Milton');
    expect(commit.authorEmail).to.equal('john@paradiselost.com');
    expect(commit.message).to.equal('First commit');
    expect(commit.authorDate).to.equal('2017-01-16T12:21:00+03:00');
  });

  it('can include separate committer info', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    (await change.get('example.txt', { allowCreate: true })).setContent('something');
    let id = await change.finalize(commitOpts({
      message: 'Second commit',
      authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa'),
      committerName: 'The Committer',
      committerEmail: 'committer@git.com'
    }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.authorName).to.equal('John Milton');
    expect(commit.authorEmail).to.equal('john@paradiselost.com');
    expect(commit.committerName).to.equal('The Committer');
    expect(commit.committerEmail).to.equal('committer@git.com');
  });

  it('can fast-forward merge some new content', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    let id = await change.finalize(commitOpts({ message: 'Second commit' }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let masterCommit = await inRepo(path).getCommit('master');
    expect(masterCommit.id).to.equal(id);

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');
  });

  it('automatically fast-forwards when no base version is provided', async function() {
    let { repo } = await makeRepo(path);

    let change = await Change.create(repo, null, 'master');
    let file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    let id = await change.finalize(commitOpts({ message: 'Second commit' }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let head = await inRepo(path).getCommit('master');
    expect(head.id).to.equal(id);

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');
  });

  it('can detect unintended filename collision', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample'
    });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt', { allowCreate: true });

    try {
      file.setContent('something else');
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceof(Change.OverwriteRejected);
    }
  });


  it('non-fast-forward merge some new content', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    let commitId = await change.finalize(commitOpts({ message: 'Second commit' }));
    expect(commitId).is.a('string');

    // This is based on the same parentRef as the second commit, so it's not a fast forward
    change = await Change.create(repo, head, 'master');
    file = await change.get('other.txt', { allowCreate: true });
    file.setContent('Non-conflicting content');
    commitId = await change.finalize(commitOpts({ message: 'Third commit' }));
    expect(commitId).is.a('string');

    expect((await inRepo(path).getCommit('master')).message).to.equal('Clean merge into master');
    expect((await inRepo(path).getCommit('master^1')).message).to.equal('Third commit');
    expect((await inRepo(path).getCommit('master^2')).message).to.equal('Second commit');
    expect(await inRepo(path).getContents('master', 'hello-world.txt')).to.equal('This is a file');
    expect(await inRepo(path).getContents('master', 'other.txt')).to.equal('Non-conflicting content');
  });

  it('rejects conflicting merge', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    await change.finalize(commitOpts({ message: 'Second commit' }));

    change = await Change.create(repo, head, 'master');
    file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('Conflicting content');

    try {
      await change.finalize(commitOpts({ message: 'Third commit' }));
      throw new Error("merge was not supposed to succeed");
    } catch(err) {
      expect(err).instanceof(Change.GitConflict);
    }

    expect((await inRepo(path).getCommit('master')).message).to.equal('Second commit');
    expect(await inRepo(path).getContents('master', 'hello-world.txt')).to.equal('This is a file');
    let listing = await inRepo(path).listTree('master', '');
    expect(listing.length).to.equal(1);
    expect(listing[0].name).to.equal('hello-world.txt');
  });

  it('can add new directories', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('outer/inner/hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    let id = await change.finalize(commitOpts({ message: 'Second commit' }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit');

    let masterCommit = await inRepo(path).getCommit('master');
    expect(masterCommit.message).to.equal('Second commit');

    expect(await inRepo(path).getContents(id, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });

  it('can add new file within directory', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/inner/hello-world.txt': 'This is a file'
    });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('outer/inner/second.txt', { allowCreate: true });
    file.setContent('second file');

    head = await change.finalize(commitOpts());

    expect(await inRepo(path).getContents(head, 'outer/inner/second.txt')).to.equal('second file');
    expect(await inRepo(path).getContents(head, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });

  it('can delete a file at the top level', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample'
    });

    let listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal(['sample.txt']);

    let updates = [
      {
        operation: 'delete',
        filename: 'sample.txt'
      }
    ];

    head = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);

  });

  it('can delete a file at an inner level', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt':'sample',
      'outer/second.txt': 'second'
    });

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');
    expect(listing).to.contain('second.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let updates = [
      {
        operation: 'delete',
        filename: 'outer/sample.txt'
      }
    ];

    head = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.deep.equal(['second.txt']);

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

  });

  it('can delete a whole subtree', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample'
    });

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let updates = [
      {
        operation: 'delete',
        filename: 'outer/sample.txt'
      }
    ];

    head = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);
  });

  it('rejects deletion within missing directory', async function() {
    let { repo, head } = await makeRepo(path);
    let updates = [
      {
        operation: 'delete',
        filename: 'outer/sample.txt'
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }

  });


  it('rejects deletion of missing file', async function() {
    let { repo, head } = await makeRepo(path);
    let updates = [
      {
        operation: 'delete',
        filename: 'sample.txt'
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }

  });


  it('rejects double deletion file', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample'
    });

    let updates = [
      {
        operation: 'delete',
        filename: 'outer/sample.txt'
      },
      {
        operation: 'delete',
        filename: 'outer/sample.txt'
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }

  });


  it('rejects double deletion of directory', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample'
    });
    let updates = [
      {
        operation: 'delete',
        filename: 'outer'
      },
      {
        operation: 'delete',
        filename: 'outer'
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Deleting' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }

  });

  it('rejects update within missing directory', async function() {
    let { repo, head } = await makeRepo(path);
    let updates = [
      {
        operation: 'update',
        filename: 'outer/sample.txt',
        buffer: Buffer.from('sample', 'utf8')
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'updating' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }
  });

  it('rejects update of missing file', async function() {
    let { repo, head } = await makeRepo(path);
    let updates = [
      {
        operation: 'update',
        filename: 'sample.txt',
        buffer: Buffer.from('sample', 'utf8')
      }
    ];

    try {
      await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'updating' }));
      throw new Error("should not get here");
    } catch (err) {
      expect(err).instanceOf(Change.NotFound);
    }
  });

  it('can update a file', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample'
    });

    let updates = [
      {
        operation: 'update',
        filename: 'sample.txt',
        buffer: Buffer.from('updated', 'utf8')
      }
    ];

    head = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Updating' }));
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('updated');
  });

  it('gracefully handles a no-op', async function() {
    let { repo, head } = await makeRepo(path);
    let newHead = await Change.applyOperations(repo, head, 'master', [], commitOpts({ message: 'Unused' }));
    expect(newHead).to.equal(head);
  });

  it('can patch a file', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample'
    });
    let updates = [
      {
        operation: 'patch',
        filename: 'sample.txt',
        patcherThis: { isCorrectContext: true },
        patcher(originalBuffer) {
          expect(this).has.property('isCorrectContext');
          return Buffer.from('The original was: ' + originalBuffer.toString('utf8'), 'utf8');
        }
      }
    ];

    head = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Updating' }));
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('The original was: sample');
  });

  it('can abort a patch', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample'
    });

    let updates = [
      {
        operation: 'patch',
        filename: 'sample.txt',
        patcher() {
          return null;
        }
      }
    ];

    let newHead = await Change.applyOperations(repo, head, 'master', updates, commitOpts({ message: 'Updating' }));
    expect(newHead).to.equal(head);
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('sample');
  });

});
