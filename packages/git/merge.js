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
  MutableTree,
  NotFound,
  OverwriteRejected
} = require('./mutable-tree');
const moment = require('moment-timezone');

// This is supposed to enable thread-safe locking around all async
// operations.
setThreadSafetyStatus(1);

function signature(commitOpts) {
  let date = commitOpts.authorDate || moment();
  let author = Signature.create(commitOpts.authorName, commitOpts.authorEmail, date.unix(), date.utcOffset());
  let committer = commitOpts.committerName ? Signature.create(commitOpts.committerName, commitOpts.committerEmail, date.unix(), date.utcOffset()) : author;
  return {
    author,
    committer
  };
}

exports.createEmptyRepo = async function(path, commitOpts) {
  let change = await Change.createInitial(path, 'master', commitOpts);
  await change.finalize();
  return change.repo;
};

class Change {
  static async createInitial(repoPath, targetBranch, commitOpts) {
    let repo = await Repository.init(repoPath, 1);
    return new this(repo, commitOpts, targetBranch, null, [], null, null, null);
  }

  static async create(repo, parentId, targetBranch, commitOpts) {
    let headRef = await Branch.lookup(repo, targetBranch, Branch.BRANCH.LOCAL);
    let headCommit = await Commit.lookup(repo, headRef.target());

    let parentCommit;
    if (parentId) {
      parentCommit = await Commit.lookup(repo, parentId);
    } else {
      parentCommit = headCommit;
    }

    let parentTree;
    let parents = [];
    if (parentCommit) {
      parentTree = await parentCommit.getTree();
      parents.push(parentCommit);
    }
    return new this(repo, commitOpts, targetBranch, parentTree, parents, parentCommit, headRef, headCommit);
  }

  constructor(repo, commitOpts, targetBranch, parentTree, parents, parentCommit, headRef, headCommit) {
    this.repo = repo;
    this.parentTree = parentTree;
    this.root = new MutableTree(repo, parentTree);
    this.parents = parents;
    this.parentCommit = parentCommit;
    this.headRef = headRef;
    this.headCommit = headCommit;
    this.commitOpts = commitOpts;
    this.targetBranch = targetBranch;
  }

  async applyOperations(operations) {
    let newRoot = this.root;
    for (let { operation, filename, buffer, patcher, patcherThis } of operations) {
      switch (operation) {
      case 'create':
        await newRoot.insertPath(filename, buffer, FILEMODE.BLOB, { allowUpdate: false, allowCreate: true });
        break;
      case 'update':
        await newRoot.insertPath(filename, buffer, FILEMODE.BLOB, { allowUpdate: true, allowCreate: false });
        break;
      case 'patch':
        await newRoot.patchPath(filename, patcher, patcherThis, { allowCreate: false });
        break;
      case 'delete':
        await newRoot.deletePath(filename);
        break;
      case 'createOrUpdate':
        await newRoot.insertPath(filename, buffer, FILEMODE.BLOB, { allowUpdate: true, allowCreate: true } );
        break;
      default:
        throw new Error("no operation");
      }
    }
  }

  async finalize() {
    let newCommit = await this._makeCommit();
    return this._mergeCommit(newCommit);
  }

  async _makeCommit() {
    let treeOid = await this.root.write(true);

    if (treeOid && this.parentTree && treeOid.equal(this.parentTree.id())) {
      return this.parentCommit;
    }

    let tree = await Tree.lookup(this.repo, treeOid, null);
    let { author, committer } = signature(this.commitOpts);
    let commitOid = await Commit.create(this.repo, null, author, committer, 'UTF-8', this.commitOpts.message, tree, this.parents.length, this.parents);
    return Commit.lookup(this.repo, commitOid);
  }

  async _mergeCommit(newCommit) {
    if (!this.headCommit) {
      return this._newBranch(newCommit);
    }
    let baseOid = await Merge.base(this.repo, newCommit, this.headCommit);
    if (baseOid.equal(this.headCommit.id())) {
      await this.headRef.setTarget(newCommit.id(), 'fast forward');
      return newCommit.id().tostrS();
    }
    let index = await Merge.commits(this.repo, newCommit, this.headCommit, null);
    if (index.hasConflicts()) {
      throw new GitConflict(index);
    }
    let treeOid = await index.writeTreeTo(this.repo);
    let tree = await Tree.lookup(this.repo, treeOid, null);
    let { author, committer } = signature(this.commitOpts);
    let mergeCommitOid = await Commit.create(this.repo, null, author, committer, 'UTF-8', `Clean merge into ${this.targetBranch}`, tree, 2, [newCommit, this.headCommit]);
    let mergeCommit = await Commit.lookup(this.repo, mergeCommitOid);
    await this.headRef.setTarget(mergeCommit.id(), 'fast forward');
    return mergeCommit.id().tostrS();
  }

  async _newBranch(newCommit) {
    await Branch.create(this.repo, 'master', newCommit, false);
    return newCommit.id().tostrS();
  }
}

exports.mergeCommit = async function(repo, parentId, targetBranch, operations, commitOpts) {
  let change = await Change.create(repo, parentId, targetBranch, commitOpts);
  await change.applyOperations(operations);
  let mergeCommitId = await change.finalize();
  return mergeCommitId;
};

class GitConflict extends Error {
  constructor(index) {
    super();
    this.index = index;
  }
}

exports.GitConflict = GitConflict;
exports.NotFound = NotFound;
exports.OverwriteRejected = OverwriteRejected;
