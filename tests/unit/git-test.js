const denodeify = require('denodeify');
const git = require('../../src/git');
const _temp = require('temp').track();
const temp = {
  mkdir: denodeify(_temp.mkdir),
  cleanup: denodeify(_temp.cleanup)
};
const inRepo = require('../git-assertions').inRepo;
const moment = require('moment-timezone');

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

    await git.createEmptyRepo(path, {
      authorName: 'John Milton',
      authorEmail: 'john@paradiselost.com',
      message: 'First commit',
      authorDate: moment.tz('2017-01-16 12:21', 'Africa/Addis_Ababa')
    });

    let commit = await inRepo(path).getCommit('master');
    expect(commit.authorName).to.equal('John Milton');
    expect(commit.authorEmail).to.equal('john@paradiselost.com');
    expect(commit.message).to.equal('First commit');
    expect(commit.authorDate).to.equal('2017-01-16T12:21:00+03:00');
  });

});
