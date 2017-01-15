const denodeify = require('denodeify');
const git = require('../../src/git');
const _temp = require('temp').track();
const temp = {
  mkdir: denodeify(_temp.mkdir),
  cleanup: denodeify(_temp.cleanup)
};

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
    await git.createEmptyRepo(path);
    expect(false).to.equal(true, 'create assertions against repo using normal CLI git here');
  });

});
