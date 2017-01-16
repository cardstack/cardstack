const {
  Blob,
  Branch,
  Commit,
  Merge,
  Repository,
  Signature,
  Tree,
  Treebuilder,
  setThreadSafetyStatus
} = require('nodegit');
const moment = require('moment-timezone');

// This is supposed to enable thread-safe locking around all async
// operations.
setThreadSafetyStatus(1);

function signature(commitOpts) {
  let date = commitOpts.authorDate || moment();
  return Signature.create(commitOpts.authorName, commitOpts.authorEmail, date.unix(), date.utcOffset());
}

exports.createEmptyRepo = async function(path, commitOpts) {
  let sig = signature(commitOpts);
  let repo = await Repository.init(path, 1);

  let builder = await Treebuilder.create(repo, null);
  let treeOid = builder.write();

  let tree = await Tree.lookup(repo, treeOid, null);

  let commitOid = await Commit.create(repo, null, sig, sig, 'UTF-8', commitOpts.message, tree, 0, []);
  let commit = await Commit.lookup(repo, commitOid);
  await Branch.create(repo, 'master', commit, false);
  return repo;
};

async function makeCommit(repo, parentCommit, updatedContents, commitOpts) {
  let parentTree = await parentCommit.getTree();
  let builder = await Treebuilder.create(repo, parentTree);
  for (let { filename, filemode, buffer } of updatedContents) {
    let blobOid = Blob.createFromBuffer(repo, buffer, buffer.length);
    await builder.insert(filename, blobOid, filemode);
  }

  let treeOid = builder.write();

  let tree = await Tree.lookup(repo, treeOid, null);
  let sig = signature(commitOpts);
  let commitOid = await Commit.create(repo, null, sig, sig, 'UTF-8', commitOpts.message, tree, 1, [parentCommit]);
  return Commit.lookup(repo, commitOid);
}

exports.mergeCommit = async function(repo, parentId, targetBranch, updatedContents, commitOpts) {
  let parentCommit = await Commit.lookup(repo, parentId);
  let newCommit = await makeCommit(repo, parentCommit, updatedContents, commitOpts);

  let headRef = await Branch.lookup(repo, targetBranch, Branch.BRANCH.LOCAL);
  let headCommit = await Commit.lookup(repo, headRef.target());

  let baseOid = await Merge.base(repo, newCommit, headCommit);
  if (baseOid.equal(headCommit.id())) {
    await headRef.setTarget(newCommit.id(), 'fast forward');
    return newCommit;
  }
};
