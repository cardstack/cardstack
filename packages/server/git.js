const {
  Branch,
  Commit,
  Merge,
  Repository,
  Signature,
  Tree,
  setThreadSafetyStatus,
  TreeEntry: { FILEMODE }
} = require('nodegit');
const {
  MutableTree
} = require('./mutable-tree');
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

async function makeCommit(repo, parentCommit, updatedContents, commitOpts) {
  let parentTree;
  let parents = [];
  if (parentCommit) {
    parentTree = await parentCommit.getTree();
    parents.push(parentCommit);
  }
  let newRoot = new MutableTree(repo, parentTree);
  for (let { filename, buffer } of updatedContents) {
    await newRoot.insertPath(filename, buffer, FILEMODE.BLOB);
  }
  let treeOid = await newRoot.write(true);
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
    return newCommit.id().tostrS();
  }
  let index = await Merge.commits(repo, newCommit, headCommit, null);
  if (index.hasConflicts()) {
    throw new GitConflict(index);
  }
  let treeOid = await index.writeTreeTo(repo);
  let tree = await Tree.lookup(repo, treeOid, null);
  let sig = signature(commitOpts);
  let mergeCommitOid = await Commit.create(repo, null, sig, sig, 'UTF-8', `Clean merge into ${targetBranch}`, tree, 2, [newCommit, headCommit]);
  let mergeCommit = await Commit.lookup(repo, mergeCommitOid);
  await headRef.setTarget(mergeCommit.id(), 'fast forward');
  return mergeCommit.id().tostrS();
};

class GitConflict extends Error {
  constructor(index) {
    super();
    this.index = index;
  }
}

exports.GitConflict = GitConflict;
