const Git = require('nodegit');

exports.createEmptyRepo = async function(path) {
  let date = new Date();
  let sig = Git.Signature.create('Edward Faulkner', 'ef@alum.mit.edu', date.getTime()/1000, -date.getTimezoneOffset());
  let repo = await Git.Repository.init(path, 1);

  let builder = await Git.Treebuilder.create(repo, null);
  let treeOid = builder.write();

  let tree = await Git.Tree.lookup(repo, treeOid, null);

  let commitOid = await Git.Commit.create(repo, null, sig, sig, 'UTF-8', 'This is the first commit', tree, 0, [])

  let commit = await Git.Commit.lookup(repo, commitOid);
  await Git.Branch.create(repo, 'master', commit, false);
};
