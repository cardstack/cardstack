const {
  Blob,
  Branch,
  Commit,
  Merge,
  Repository,
  Signature,
  Tree,
  Treebuilder,
  TreeEntry,
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
  let repo = await Repository.init(path, 1);
  let commit = await makeCommit(repo, null, [], commitOpts);
  await Branch.create(repo, 'master', commit, false);
  return repo;
};

async function insertBlob(repo, builder, path, blobOid) {
  if (path.length === 1) {
    await builder.insert(path[0], blobOid, TreeEntry.FILEMODE.BLOB);
  }
}

async function makeCommit(repo, parentCommit, updatedContents, commitOpts) {
  let parentTree;
  let parents = [];
  if (parentCommit) {
    parentTree = await parentCommit.getTree();
    parents.push(parentCommit);
  }
  let builder = await Treebuilder.create(repo, parentTree);
  for (let { filename, buffer } of updatedContents) {
    let blobOid = Blob.createFromBuffer(repo, buffer, buffer.length);
    await insertBlob(repo, builder, filename.split('/'), blobOid);
  }

  let treeOid = builder.write();

  let tree = await Tree.lookup(repo, treeOid, null);
  let sig = signature(commitOpts);
  let commitOid = await Commit.create(repo, null, sig, sig, 'UTF-8', commitOpts.message, tree, parents.length, parents);
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
    return { success: newCommit };
  }
  let index = await Merge.commits(repo, newCommit, headCommit, null);
  if (index.hasConflicts()) {
    return { conflict: index };
  }
  let treeOid = await index.writeTreeTo(repo);
  let tree = await Tree.lookup(repo, treeOid, null);
  let sig = signature(commitOpts);
  let mergeCommitOid = await Commit.create(repo, null, sig, sig, 'UTF-8', `Clean merge into ${targetBranch}`, tree, 2, [newCommit, headCommit]);
  let mergeCommit = await Commit.lookup(repo, mergeCommitOid);
  await headRef.setTarget(mergeCommit.id(), 'fast forward');
  return { success: mergeCommit };
};
