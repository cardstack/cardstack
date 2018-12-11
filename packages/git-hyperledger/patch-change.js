const Change = require('@cardstack/git/change');
const Gitchain = require('cardstack-gitchain');
const oldMakeCommit = Change.prototype._makeCommit;
const log = require('@cardstack/logger')('cardstack/git-hyperledger');

Change.prototype._makeCommit = async function(commitOpts) {
  let commit = await oldMakeCommit.call(this, commitOpts);

  let gitchain = new Gitchain(this.repo.path(), null, {logger: log.info.bind(log)});

  try {
    await gitchain.push(commit.sha());
  } catch (e) {
    log.error("Error pushing to hyperledger blockchain");
  }

  return commit;
};
