const {
  Repository,
  Branch,
  Reference,
  Commit
} = require('nodegit');


/* eslint-env node */
module.exports = {
  normalizeEntityName: function() {
    // this prevents an error when the entityName is
    // not specified (since that doesn't actually matter
    // to us
  },

  description: 'Generate initial seed models to configure @cardstack/git.',

  async afterInstall({ target, ui }) {
    let repo = await Repository.open(target);
    try {
      await Branch.lookup(repo, 'cs-master', Branch.BRANCH.LOCAL);
      ui.writeInfoLine("Not creating branch cs-master because it exists");
      return;
    } catch (err) {
      if (!/Cannot locate local branch/i.test(err.message)) {
        throw err;
      }
      let oid = await Reference.nameToId(repo, 'HEAD');
      let headCommit = await Commit.lookup(repo, oid);
      // zero here means "don't force"
      await Branch.create(repo, 'cs-master', headCommit, 0);
      ui.writeInfoLine("Created branch cs-master");
    }

  }
};
