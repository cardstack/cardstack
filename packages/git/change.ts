import { Commit, Merge, Repository, Tree, FILEMODE, FetchOptions, CommitOpts, BranchNotFound } from './git';

import { NewEntry, MutableTree, NotFound, OverwriteRejected } from './mutable-tree';

import moment from 'moment-timezone';

import crypto from 'crypto';
import delay from 'delay';
import logger from '@cardstack/logger';
const log = logger('cardstack/git');

export default class Change {
  static NotFound = NotFound;
  static OverwriteRejected = OverwriteRejected;

  static async createInitial(repoPath: string, targetBranch: string) {
    let repo = await Repository.initBare(repoPath);
    return new this(repo, targetBranch, undefined, []);
  }

  static async createBranch(repo: Repository, parentId: string, targetBranch: string, fetchOpts?: FetchOptions) {
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
    return new this(repo, targetBranch, parentTree, parents, parentCommit, fetchOpts);
  }

  static async create(repo: Repository, parentId: string | null, targetBranch: string, fetchOpts?: FetchOptions) {
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

  root: MutableTree;

  constructor(
    public repo: Repository,
    public targetBranch: string,
    public parentTree: Tree | undefined,
    public parents: Commit[],
    public parentCommit?: Commit,
    public fetchOpts?: FetchOptions
  ) {
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

  async get(path: string, { allowCreate, allowUpdate }: { allowCreate?: boolean; allowUpdate?: boolean } = {}) {
    let { tree, leaf, leafName } = await this.root.fileAtPath(path, !!allowCreate);
    return new FileHandle(tree, leaf, leafName, !!allowUpdate, path);
  }

  async finalize(commitOpts: CommitOpts) {
    let newCommit = await this._makeCommit(commitOpts);

    let delayTime = 500;
    let mergeCommit;
    let needsFetchAll = false;

    while (delayTime <= 5000) {
      mergeCommit = await this._makeMergeCommit(newCommit!, commitOpts);

      try {
        if (this.fetchOpts) {
          // needsFetchAll only gets set to true if the retry block has failed once
          if (needsFetchAll) {
            // pull remote before allowing process to continue, allowing us to
            // (hopefully) recover from upstream getting out of sync
            await this.repo.fetchAll(this.fetchOpts);
          }
          await this._pushCommit(mergeCommit);
        } else {
          await this._applyCommit(mergeCommit);
        }
      } catch (err) {
        log.warn('Failed to finalize commit "%s"', err);
        needsFetchAll = true;

        await delay(delayTime);
        delayTime *= 2;

        continue;
      }

      if (this.fetchOpts && !this.repo.isBare()) {
        await this.repo.fetchAll(this.fetchOpts);
        await this.repo.mergeBranches(this.targetBranch, `origin/${this.targetBranch}`, null, Merge.FASTFORWARD_ONLY);
      }

      return mergeCommit.id().tostrS();
    }

    throw new Error('Failed to finalise commit and could not recover. ');
  }

  async _makeCommit(commitOpts: CommitOpts) {
    let treeOid = await this.root.write(true);
    if (treeOid && this.parentTree && treeOid.equal(this.parentTree.id())) {
      return this.parentCommit;
    }

    let tree = await Tree.lookup(this.repo, treeOid!);
    let commitOid = await Commit.create(this.repo, commitOpts, tree, this.parents);

    return Commit.lookup(this.repo, commitOid);
  }

  async _pushCommit(mergeCommit: Commit) {
    const remoteBranchName = `temp-remote-${crypto.randomBytes(20).toString('hex')}`;
    await this.repo.createBranch(remoteBranchName, mergeCommit);

    let remote = await this.repo.getRemote('origin');

    try {
      await remote.push(`refs/heads/${remoteBranchName}`, `refs/heads/${this.targetBranch}`, { force: true });
    } catch (err) {
      // pull remote before allowing process to continue
      await this.repo.fetchAll(this.fetchOpts);
      throw err;
    }
  }

  async _makeMergeCommit(newCommit: Commit, commitOpts: CommitOpts) {
    let headCommit = await this._headCommit();

    if (!headCommit) {
      // new branch, so no merge needed
      return newCommit;
    }
    let baseOid = await Merge.base(this.repo, newCommit.id(), headCommit.id());
    if (baseOid.equal(headCommit.id())) {
      // fast forward (we think), so no merge needed
      return newCommit;
    }

    commitOpts.message = `Clean merge into ${this.targetBranch}`;

    let mergeResult = await Merge.perform(this.repo, newCommit, headCommit, commitOpts);

    return await Commit.lookup(this.repo, mergeResult.oid!);
  }

  async _applyCommit(commit: Commit) {
    let headCommit = await this._headCommit();

    if (!headCommit) {
      return await this._newBranch(commit);
    }

    let headRef = await this.repo.lookupLocalBranch(this.targetBranch);
    await headRef.setTarget(commit.id());
  }

  async _newBranch(newCommit: Commit) {
    await this.repo.createBranch(this.targetBranch, newCommit);
  }
}

class FileHandle {
  public mode: number;

  constructor(
    public tree: MutableTree,
    public leaf: NewEntry | null,
    public name: string,
    public allowUpdate: boolean,
    public path: string
  ) {
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
      return (await this.leaf!.getBlob()!).content();
    }
  }
  exists() {
    return !!this.leaf;
  }
  setContent(buffer: Buffer | string) {
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'utf8');
    }
    if (!(buffer instanceof Buffer)) {
      throw new Error('setContent got something that was not a Buffer or String');
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
    if (this.leaf && this.leaf.savedId) {
      return this.leaf.savedId.tostrS();
    }
  }
}

module.exports = Change;

async function headCommit(repo: Repository, targetBranch: string, fetchOpts?: FetchOptions) {
  let headRef;
  try {
    if (fetchOpts) {
      headRef = await repo.lookupRemoteBranch('origin', targetBranch);
    } else {
      headRef = await repo.lookupLocalBranch(targetBranch);
    }
  } catch (err) {
    if (err.constructor !== BranchNotFound) {
      throw err;
    }
  }
  if (headRef) {
    return await Commit.lookup(repo, headRef.target());
  }
}
