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


class Change {
  static async createInitial(repoPath, targetBranch) {
    let repo = await Repository.init(repoPath, 1);
    return new this(repo, targetBranch, null, [], null, null, null);
  }

  static async create(repo, parentId, targetBranch) {
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
    return new this(repo, targetBranch, parentTree, parents, parentCommit, headRef, headCommit);
  }

  // TODO: refactor away
  static async applyOperations(repo, parentId, targetBranch, operations, commitOpts){
    let change = await this.create(repo, parentId, targetBranch);
    await change.applyOperations(operations);
    return change.finalize(commitOpts);
  }

  constructor(repo, targetBranch, parentTree, parents, parentCommit, headRef, headCommit) {
    this.repo = repo;
    this.parentTree = parentTree;
    this.root = new MutableTree(repo, parentTree);
    this.parents = parents;
    this.parentCommit = parentCommit;
    this.headRef = headRef;
    this.headCommit = headCommit;
    this.targetBranch = targetBranch;
  }

  async get(path, { allowCreate, allowUpdate } = {}) {
    let { tree, leaf, leafName } = await this.root.fileAtPath(path, allowCreate);
    return new FileHandle(tree, leaf, leafName, allowUpdate, path);
  }

  // TODO: refactor away
  async applyOperations(operations) {
    let newRoot = this.root;
    for (let { operation, filename, buffer, patcher, patcherThis } of operations) {
      switch (operation) {
      case 'create':
        (await this.get(filename, { allowCreate: true })).setContent(buffer);
        break;
      case 'update':
        (await this.get(filename, { allowUpdate: true })).setContent(buffer);
        break;
      case 'patch':
        await newRoot.patchPath(filename, patcher, patcherThis, { allowCreate: false });
        break;
      case 'delete':
        (await this.get(filename)).delete();
        break;
      case 'createOrUpdate':
        (await this.get(filename, { allowUpdate: true, allowCreate: true } )).setContent(buffer);
        break;
      default:
        throw new Error("no operation");
      }
    }
  }

  async finalize(commitOpts) {
    let newCommit = await this._makeCommit(commitOpts);
    return this._mergeCommit(newCommit, commitOpts);
  }

  async _makeCommit(commitOpts) {
    let treeOid = await this.root.write(true);

    if (treeOid && this.parentTree && treeOid.equal(this.parentTree.id())) {
      return this.parentCommit;
    }

    let tree = await Tree.lookup(this.repo, treeOid, null);
    let { author, committer } = signature(commitOpts);
    let commitOid = await Commit.create(this.repo, null, author, committer, 'UTF-8', commitOpts.message, tree, this.parents.length, this.parents);
    return Commit.lookup(this.repo, commitOid);
  }

  async _mergeCommit(newCommit, commitOpts) {
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
    let { author, committer } = signature(commitOpts);
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

function signature(commitOpts) {
  let date = commitOpts.authorDate || moment();
  let author = Signature.create(commitOpts.authorName, commitOpts.authorEmail, date.unix(), date.utcOffset());
  let committer = commitOpts.committerName ? Signature.create(commitOpts.committerName, commitOpts.committerEmail, date.unix(), date.utcOffset()) : author;
  return {
    author,
    committer
  };
}

class GitConflict extends Error {
  constructor(index) {
    super();
    this.index = index;
  }
}

class FileHandle {
  constructor(tree, leaf, name, allowUpdate, path) {
    this.tree = tree;
    this.leaf = leaf;
    this.name = name;
    this.allowUpdate = allowUpdate;
    this.path = path;
    if (leaf) {
      this.mode = leaf.filemode();
    } else {
      this.mode = FILEMODE.BLOB;
    }
  }
  async getBuffer() {
    if (this.leaf) {
      return (await this.leaf.getBlob()).content();
    }
  }
  setContent(buffer) {
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'utf8');
    }
    if (!(buffer instanceof Buffer)) {
      throw new Error("setContent got something that was not a Buffer or String");
    }
    if (!this.allowUpdate && this.leaf) {
      throw new OverwriteRejected(`Refusing to overwrite ${this.path}`);
    }
    this.leaf = this.tree.insert(this.name, buffer, this.mode);
  }
  delete() {
    if (!this.leaf) {
      throw new NotFound(`No such file ${this.path}`);
    }
    return this.tree.delete(this.name);
  }
}

Change.GitConflict = GitConflict;
Change.NotFound = NotFound;
Change.OverwriteRejected = OverwriteRejected;

module.exports = Change;
