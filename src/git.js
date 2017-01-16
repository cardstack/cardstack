const Git = require('nodegit');
const moment = require('moment-timezone');

exports.createEmptyRepo = async function(path, opts={}) {
  let date = opts.authorDate || moment();
  let sig = Git.Signature.create(opts.authorName, opts.authorEmail, date.unix(), date.utcOffset());
  let repo = await Git.Repository.init(path, 1);

  let builder = await Git.Treebuilder.create(repo, null);
  let treeOid = builder.write();

  let tree = await Git.Tree.lookup(repo, treeOid, null);

  let commitOid = await Git.Commit.create(repo, null, sig, sig, 'UTF-8', opts.message, tree, 0, []);
  let commit = await Git.Commit.lookup(repo, commitOid);
  await Git.Branch.create(repo, 'master', commit, false);
};
