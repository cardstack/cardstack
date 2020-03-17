import { Commit, Merge, Repository, CommitOpts, BranchNotFound, Oid } from './git';
import Tree, { TreeEntry, FileNotFound, OverwriteRejected, FILEMODE } from './tree';

import crypto from 'crypto';
import delay from 'delay';
import logger from '@cardstack/logger';
const log = logger('cardstack/git');

export default class Change {
  static async createInitial(repoPath: string, targetBranch: string) {
    let repo = await Repository.initBare(repoPath);
    return new this(repo, targetBranch, undefined, []);
  }

  static async createBranch(repo: Repository, parentId: string, targetBranch: string) {
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
    return new this(repo, targetBranch, parentTree, parents, parentCommit);
  }

  static async create(repo: Repository, parentId: string | null, targetBranch: string, isRemote?: boolean) {
    let parentCommit;
    if (parentId) {
      parentCommit = await Commit.lookup(repo, parentId);
    } else {
      parentCommit = await headCommit(repo, targetBranch, !!isRemote);
    }

    let parentTree;
    let parents = [];
    if (parentCommit) {
      parentTree = await parentCommit.getTree();
      parents.push(parentCommit);
    }
    return new this(repo, targetBranch, parentTree, parents, parentCommit, isRemote);
  }

  root: Tree;
  isRemote: boolean;

  constructor(
    public repo: Repository,
    public targetBranch: string,
    public parentTree: Tree | undefined,
    public parents: Commit[],
    public parentCommit?: Commit,
    isRemote?: boolean
  ) {
    this.repo = repo;
    this.root = parentTree || Tree.create(repo, parentTree);
    this.isRemote = !!isRemote;
  }

  private async headCommit() {
    return headCommit(this.repo, this.targetBranch, this.isRemote);
  }

  async get(path: string, { allowCreate, allowUpdate }: { allowCreate?: boolean; allowUpdate?: boolean } = {}) {
    let { tree, leaf, leafName } = await this.root.fileAtPath(path, !!allowCreate);
    return new FileHandle(tree, leaf, leafName, !!allowUpdate, path);
  }

  async finalize(commitOpts: CommitOpts) {
    let newCommit = await this.makeCommit(commitOpts);

    let delayTime = 500;
    let mergeCommit;
    let needsFetchAll = false;

    while (delayTime <= 5000) {
      mergeCommit = await this.makeMergeCommit(newCommit!, commitOpts);

      try {
        if (this.isRemote) {
          // needsFetchAll only gets set to true if the retry block has failed once
          if (needsFetchAll) {
            // pull remote before allowing process to continue, allowing us to
            // (hopefully) recover from upstream getting out of sync
            await this.repo.fetchAll();
          }
          await this.pushCommit(mergeCommit);
        } else {
          await this.applyCommit(mergeCommit);
        }
      } catch (err) {
        log.warn('Failed to finalize commit "%s"', err);
        needsFetchAll = true;

        await delay(delayTime);
        delayTime *= 2;

        continue;
      }

      if (this.isRemote && !this.repo.isBare()) {
        await this.repo.fetchAll();
        await this.repo.mergeBranches(this.targetBranch, `origin/${this.targetBranch}`);
      }

      return mergeCommit.id().toString();
    }

    throw new Error('Failed to finalise commit and could not recover. ');
  }

  private async makeCommit(commitOpts: CommitOpts) {
    if (!this.root.dirty) {
      return this.parentCommit;
    }
    let treeOid = await this.root.write(true);

    let tree = await Tree.lookup(this.repo, treeOid!);
    let commitOid = await Commit.create(this.repo, commitOpts, tree, this.parents);

    return Commit.lookup(this.repo, commitOid);
  }

  private async pushCommit(mergeCommit: Commit) {
    const remoteBranchName = `temp-remote-${crypto.randomBytes(20).toString('hex')}`;
    await this.repo.createBranch(remoteBranchName, mergeCommit);

    let remote = await this.repo.getRemote('origin');

    try {
      await remote.push(`refs/heads/${remoteBranchName}`, `refs/heads/${this.targetBranch}`, { force: true });
    } catch (err) {
      // pull remote before allowing process to continue
      await this.repo.fetchAll();
      throw err;
    }
  }

  private async makeMergeCommit(newCommit: Commit, commitOpts: CommitOpts) {
    let headCommit = await this.headCommit();

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

  private async applyCommit(commit: Commit) {
    let headCommit = await this.headCommit();

    if (!headCommit) {
      return await this.newBranch(commit);
    }

    let headRef = await this.repo.lookupLocalBranch(this.targetBranch);
    await headRef.setTarget(commit.id());
  }

  private async newBranch(newCommit: Commit) {
    await this.repo.createBranch(this.targetBranch, newCommit);
  }
}

export class FileHandle {
  public mode: FILEMODE;

  constructor(
    public tree: Tree,
    public leaf: TreeEntry | undefined,
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
      throw new FileNotFound(`No such file ${this.path}`);
    }
    this.tree.delete(this.name);
    this.leaf = undefined;
  }
  savedId(): Oid | undefined {
    // this is available only after our change has been finalized
    return this.leaf && this.leaf.id()!;
  }
}

module.exports = Change;

async function headCommit(repo: Repository, targetBranch: string, isRemote: boolean) {
  let headRef;
  try {
    if (isRemote) {
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
