import Change from '../change';
import { GitConflict } from '../git';
import { inRepo, commitOpts, makeRepo } from './support';
import { FileNotFound, OverwriteRejected } from '../git/tree';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const temp = require('@cardstack/test-support/temp-helper');

import moment from 'moment-timezone';

describe('git/change', function() {
  let path: string;

  beforeEach(async function() {
    let root = await temp.mkdir('cardstack-server-test');
    path = `${root}/example`;
  });
  afterEach(async function() {
    await temp.cleanup();
  });

  it('can make new empty repo', async function() {
    let change = await Change.createInitial(path, 'master');
    await change.finalize(
      commitOpts({
        message: 'First commit',
        authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa'),
      })
    );

    let commit = await inRepo(path).getCommit('master');
    expect(commit.authorName).to.equal('John Milton');
    expect(commit.authorEmail).to.equal('john@paradiselost.com');
    expect(commit.message).to.equal('First commit\n');
    expect(commit.authorDate).to.equal('2017-01-16 12:21:00 +0300');
  });

  it('can include separate committer info', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');
    (await change.get('example.txt', { allowCreate: true })).setContent('something');
    let id = await change.finalize(
      commitOpts({
        message: 'Second commit',
        authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa'),
        committerName: 'The Committer',
        committerEmail: 'committer@git.com',
      })
    );

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
    expect(commit.message).to.equal('Second commit\n');

    let masterCommit = await inRepo(path).getCommit('master');
    expect(masterCommit.id).to.equal(id);

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit\n');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');
  });

  it('automatically fast-forwards when no base version is provided', async function() {
    let { repo } = await makeRepo(path);

    let change = await Change.create(repo, null, 'master');
    let file = await change.get('hello-world.txt', { allowCreate: true });
    file.setContent('This is a file');
    let id = await change.finalize(commitOpts({ message: 'Second commit' }));

    let commit = await inRepo(path).getCommit(id);
    expect(commit.message).to.equal('Second commit\n');

    let head = await inRepo(path).getCommit('master');
    expect(head.id).to.equal(id);

    let parentCommit = await inRepo(path).getCommit(id + '^');
    expect(parentCommit.message).to.equal('First commit\n');

    expect(await inRepo(path).getContents(id, 'hello-world.txt')).to.equal('This is a file');
  });

  it('can detect unintended filename collision', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample',
    });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt', { allowCreate: true });

    try {
      file.setContent('something else');
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceof(OverwriteRejected);
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

    expect((await inRepo(path).getCommit('master')).message).to.match(/Clean merge into master/);
    expect((await inRepo(path).getCommit('master^1')).message).to.equal('Third commit\n');
    expect((await inRepo(path).getCommit('master^2')).message).to.equal('Second commit\n');
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
      throw new Error('merge was not supposed to succeed');
    } catch (err) {
      expect(err).instanceof(GitConflict);
    }

    expect((await inRepo(path).getCommit('master')).message).to.equal('Second commit\n');
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
    expect(commit.message).to.equal('Second commit\n');

    let masterCommit = await inRepo(path).getCommit('master');
    expect(masterCommit.message).to.equal('Second commit\n');

    expect(await inRepo(path).getContents(id, 'outer/inner/hello-world.txt')).to.equal('This is a file');
  });

  it('can add new file within directory', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/inner/hello-world.txt': 'This is a file',
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
      'sample.txt': 'sample',
    });

    let listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal(['sample.txt']);

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt');
    file.delete();
    head = await change.finalize(commitOpts());

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);
  });

  it('can delete a file at an inner level', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample',
      'outer/second.txt': 'second',
    });

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');
    expect(listing).to.contain('second.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('outer/sample.txt');
    file.delete();
    head = await change.finalize(commitOpts());

    listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.deep.equal(['second.txt']);

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');
  });

  it('can delete a whole subtree', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample',
    });

    let listing = (await inRepo(path).listTree(head, 'outer')).map(e => e.name);
    expect(listing).to.contain('sample.txt');

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.contain('outer');

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('outer/sample.txt');
    file.delete();
    head = await change.finalize(commitOpts());

    listing = (await inRepo(path).listTree(head, '')).map(e => e.name);
    expect(listing).to.deep.equal([]);
  });

  it('rejects deletion within missing directory', async function() {
    let { repo, head } = await makeRepo(path);
    try {
      let change = await Change.create(repo, head, 'master');
      let file = await change.get('outer/sample.txt');
      file.delete();
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceOf(FileNotFound);
    }
  });

  it('rejects deletion of missing file', async function() {
    let { repo, head } = await makeRepo(path);
    try {
      let change = await Change.create(repo, head, 'master');
      let file = await change.get('sample.txt');
      file.delete();
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceOf(FileNotFound);
    }
  });

  it('rejects double deletion file', async function() {
    let { repo, head } = await makeRepo(path, {
      'outer/sample.txt': 'sample',
    });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('outer/sample.txt');
    file.delete();

    try {
      file.delete();
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceOf(FileNotFound);
    }
  });

  it('rejects update within missing directory', async function() {
    let { repo, head } = await makeRepo(path);

    let change = await Change.create(repo, head, 'master');

    try {
      await change.get('outer/sample.txt', { allowUpdate: true });
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceOf(FileNotFound);
    }
  });

  it('rejects update of missing file', async function() {
    let { repo, head } = await makeRepo(path);
    let change = await Change.create(repo, head, 'master');
    try {
      await change.get('sample.txt', { allowUpdate: true });
      throw new Error('should not get here');
    } catch (err) {
      expect(err).instanceOf(FileNotFound);
    }
  });

  it('can update a file', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample',
    });
    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt', { allowUpdate: true });
    file.setContent('updated');
    head = await change.finalize(commitOpts());
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('updated');
  });

  it('gracefully handles a no-op', async function() {
    let { repo, head } = await makeRepo(path);
    let change = await Change.create(repo, head, 'master');
    let newHead = await change.finalize(commitOpts({ message: 'Unused' }));
    expect(newHead).to.equal(head);
  });

  it('can patch a file', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample',
    });
    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt', { allowUpdate: true });
    let originalBuffer = await file.getBuffer();
    file.setContent('The original was: ' + originalBuffer!.toString('utf8'));
    head = await change.finalize(commitOpts());
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('The original was: sample');
  });

  it('can abort a patch', async function() {
    let { repo, head } = await makeRepo(path, {
      'sample.txt': 'sample',
    });

    let change = await Change.create(repo, head, 'master');
    let file = await change.get('sample.txt', { allowUpdate: true });
    await file.getBuffer();
    let newHead = await change.finalize(commitOpts());
    expect(newHead).to.equal(head);
    expect(await inRepo(path).getContents(head, 'sample.txt')).to.equal('sample');
  });

  it('respect the branch argument to createInitial', async function() {
    let change = await Change.createInitial(path, 'not-master');
    let head = await change.finalize(commitOpts());
    let notMaster = await inRepo(path).getCommit('not-master');
    expect(notMaster.id).to.equal(head);
  });
});
