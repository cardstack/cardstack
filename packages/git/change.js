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
const crypto = require('crypto');
const delay = require('delay');
const log = require('@cardstack/logger')('cardstack/git');

// This is supposed to enable thread-safe locking around all async
// operations.
setThreadSafetyStatus(1);


class Change {
  static async createInitial(repoPath, targetBranch) {
    let repo = await Repository.init(repoPath, 1);
    return new this(repo, targetBranch, null, [], null, null, null);
  }

  static async createBranch(repo, parentId, targetBranch) {
    let parentCommit;
    if (parentId) {
      parentCommit = await Commit.lookup(repo, parentId);
    }

    let parentTree;
    let parents = [];
    if (parentCommit) {
      parentTree = await parentCommit.getTree();
      parents.push(parentCommit);
    }
    return new this(repo, targetBranch, parentTree, parents, parentCommit, null, null);
  }

  static async create(repo, parentId, targetBranch, fetchOpts) {
    let parentCommit;
    if (parentId) {
      parentCommit = await Commit.lookup(repo, parentId);
    } else {
      parentCommit = await headCommit(repo, targetBranch, fetchOpts);
    }

    let parentTree;
    let parents = [];
    if (parentCommit) {
      parentTree = await parentCommit.getTree();
      parents.push(parentCommit);
    }
    return new this(repo, targetBranch, parentTree, parents, parentCommit, fetchOpts);
  }

  constructor(repo, targetBranch, parentTree, parents, parentCommit, fetchOpts) {
    this.repo = repo;
    this.parentTree = parentTree;
    this.root = new MutableTree(repo, parentTree);
    this.parents = parents;
    this.parentCommit = parentCommit;
    this.targetBranch = targetBranch;
    this.fetchOpts = fetchOpts;
  }

  async _headCommit() {
    return headCommit(this.repo, this.targetBranch, this.fetchOpts);
  }

  async get(path, { allowCreate, allowUpdate } = {}) {
    let { tree, leaf, leafName } = await this.root.fileAtPath(path, allowCreate);
    return new FileHandle(tree, leaf, leafName, allowUpdate, path);
  }

  async finalize(commitOpts) {
    let newCommit = await this._makeCommit(commitOpts);
    let commitId;

    if(this.fetchOpts) {
      commitId = await this._pushCommit(newCommit, commitOpts);
    } else {
      let mergeCommit = await this._makeMergeCommit(newCommit, commitOpts);      
      await this._applyCommit(mergeCommit);
      commitId = mergeCommit.id().tostrS();
    }

    return commitId;
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

  async _pushCommit(newCommit, commitOpts) {
    let delayTime = 500;
    while (delayTime <= 5000) {
      let mergeCommit = await this._makeMergeCommit(newCommit, commitOpts);
      const remoteBranchName = `temp-remote-${crypto.randomBytes(20).toString('hex')}`;
      await Branch.create(this.repo, remoteBranchName, mergeCommit, false);

      let remote = await this.repo.getRemote('origin');

      try {
        await remote.push([`refs/heads/${remoteBranchName}:refs/heads/${this.targetBranch}`], this.fetchOpts);
        return newCommit.id().tostrS();
      } catch (err) {
        // pull remote and retry with longer delay
        await delay(delayTime);
        await this.repo.fetchAll(this.fetchOpts);

        log.warn('Push to remote failed "%s"', err);

        delayTime *= 2;
      }
    }
    throw new Error('Push failed');
  }

  async _makeMergeCommit(newCommit, commitOpts) {
    let headCommit = await this._headCommit();

    if (!headCommit) {
      // new branch, so no merge needed
      return newCommit;
    }
    let baseOid = await Merge.base(this.repo, newCommit, headCommit);
    if (baseOid.equal(headCommit.id())) {
      // fast forward (we think), so no merge needed
      return newCommit;
    }
    let index = await Merge.commits(this.repo, newCommit, headCommit, null);
    if (index.hasConflicts()) {
      throw new GitConflict(index);
    }
    let treeOid = await index.writeTreeTo(this.repo);
    let tree = await Tree.lookup(this.repo, treeOid, null);
    let { author, committer } = signature(commitOpts);
    let mergeCommitOid = await Commit.create(this.repo, null, author, committer, 'UTF-8', `Clean merge into ${this.targetBranch}`, tree, 2, [newCommit, headCommit]);
    return await Commit.lookup(this.repo, mergeCommitOid);
  }

  async _applyCommit(commit) {
    let headCommit = await this._headCommit();

    if (!headCommit) {
      return await this._newBranch(commit);
    }

    let headRef = await Branch.lookup(this.repo, this.targetBranch, Branch.BRANCH.LOCAL);
    await headRef.setTarget(commit.id(), 'fast forward');
  }

  async _newBranch(newCommit) {
    await Branch.create(this.repo, this.targetBranch, newCommit, false);
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
  exists() {
    return !!this.leaf;
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
    this.tree.delete(this.name);
    this.leaf = null;
  }
  savedId() {
    // this is available only after our change has been finalized
    if (this.leaf.savedId) {
      return this.leaf.savedId.tostrS();
    }
  }
}

Change.GitConflict = GitConflict;
Change.NotFound = NotFound;
Change.OverwriteRejected = OverwriteRejected;

module.exports = Change;

async function headCommit(repo, targetBranch, fetchOpts) {
  let headRef;
  try {
    if (fetchOpts) {
      headRef = await Branch.lookup(repo, `origin/${targetBranch}`, Branch.BRANCH.REMOTE);
    } else {
      headRef = await Branch.lookup(repo, targetBranch, Branch.BRANCH.LOCAL);
    }
  } catch(err) {
    if (err.errorFunction !== 'Branch.lookup') {
      throw err;
    }
  }
  if (headRef) {
    return await Commit.lookup(repo, headRef.target());
  }
}
