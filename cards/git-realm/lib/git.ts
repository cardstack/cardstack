import fs, { existsSync } from 'fs';
import http from 'isomorphic-git/http/node';
import { join } from 'path';

import Tree from './tree';

const { unlink } = fs.promises;

// Temporary type wrangling until https://github.com/isomorphic-git/isomorphic-git/pull/987 is merged and released
declare module 'isomorphic-git' {
  interface ExplicitGitDir {
    gitdir: string;
  }
  interface ImplicitGitDir {
    dir: string;
  }
  type GitDir = ExplicitGitDir | ImplicitGitDir;

  export function findMergeBase(
    args: GitDir & {
      core?: string;
      fs?: any;
      oids: string[];
    }
  ): Promise<string[]>;
}
// End temporary type wrangling

import {
  addRemote as igAddRemote,
  checkout as igCheckout,
  clone as igClone,
  commit as igCommit,
  currentBranch as igCurrentBranch,
  fetch as igFetch,
  findMergeBase as igFindMergeBase,
  init as igInit,
  listBranches as igListBranches,
  log as igLog,
  merge as igMerge,
  push as igPush,
  readCommit as igReadCommit,
  resolveRef as igResolveRef,
  writeBlob as igWriteBlob,
  writeRef as igWriteRef,

  // types
  ReadCommitResult,
} from 'isomorphic-git';

export interface RemoteConfig {
  url: string;
  cacheDir: string;
}

import moment, { Moment } from 'moment-timezone';

export interface CommitOpts {
  authorDate?: Moment;
  authorEmail: string;
  authorName: string;
  message: string;
  committerName?: string;
  committerEmail?: string;
}

interface PushOptions {
  force?: boolean;
}

export class Repository {
  static async open(path: string) {
    let bare = !existsSync(join(path, '.git'));

    try {
      let opts = bare ? { fs, gitdir: path } : { fs, dir: path };
      // Try to get the current branch to check if it's really a git repo or not
      await igCurrentBranch(opts);
    } catch (e) {
      throw new RepoNotFound();
    }
    return new Repository(path, bare);
  }

  static async initBare(gitdir: string): Promise<Repository> {
    await igInit({ gitdir, bare: true, fs });
    return await Repository.open(gitdir);
  }

  static async clone(url: string, dir: string) {
    await igClone({
      fs,
      http,
      url,
      dir,
    });
    return await Repository.open(dir);
  }

  public gitdir: string;

  constructor(public path: string, private bare: boolean = false) {
    if (bare) {
      this.gitdir = path;
    } else {
      this.gitdir = join(path, '.git');
    }
  }

  async getMasterCommit(): Promise<Commit> {
    let sha = await igResolveRef({
      fs,
      gitdir: this.gitdir,
      ref: 'master',
    });
    return await Commit.lookup(this, sha);
  }

  async getRemote(remote: string): Promise<Remote> {
    return new Remote(this, remote);
  }

  async createBlobFromBuffer(buffer: Buffer): Promise<Oid> {
    let sha = await igWriteBlob({
      fs,
      gitdir: this.gitdir,
      blob: buffer,
    });

    return new Oid(sha);
  }

  async fetchAll() {
    await igFetch({
      fs,
      http,
      gitdir: this.gitdir,
    });
  }

  async mergeBranches(to: string, from: string) {
    await igMerge({
      fs,
      gitdir: this.gitdir,
      ours: to,
      theirs: from,
      fastForwardOnly: true,
    });
  }

  async getReference(branchName: string) {
    return await Reference.lookup(this, branchName);
  }

  async createBranch(targetBranch: string, headCommit: Commit): Promise<Reference> {
    await igWriteRef({
      fs,
      gitdir: this.gitdir,
      ref: `refs/heads/${targetBranch}`,
      value: headCommit.sha(),
      force: true,
    });

    return await Reference.lookup(this, targetBranch);
  }

  async checkoutBranch(reference: Reference) {
    await igCheckout({
      fs,
      dir: this.path,
      gitdir: this.gitdir,
      ref: reference.toString(),
    });
  }

  async getHeadCommit() {
    return await Commit.lookup(this, 'HEAD');
  }

  async getReferenceCommit(name: string): Promise<Commit> {
    return await Commit.lookup(this, name);
  }

  async lookupLocalBranch(branchName: string) {
    let branches = await igListBranches({ fs, gitdir: this.gitdir });

    if (branches.includes(branchName)) {
      return await this.lookupReference(`refs/heads/${branchName}`);
    } else {
      throw new BranchNotFound();
    }
  }

  async lookupRemoteBranch(remote: string, branchName: string) {
    let branches = await igListBranches({ fs, gitdir: this.gitdir, remote });

    if (branches.includes(branchName)) {
      return await this.lookupReference(`refs/remotes/${remote}/${branchName}`);
    } else {
      throw new BranchNotFound();
    }
  }

  async lookupReference(reference: string) {
    return await Reference.lookup(this, reference);
  }

  async reset(commit: Commit, hard: boolean) {
    let ref = await igCurrentBranch({
      fs,
      gitdir: this.gitdir,
      fullname: true,
    });

    await igWriteRef({
      fs,
      gitdir: this.gitdir,
      ref: ref as string,
      value: commit.sha(),
    });

    if (hard) {
      await unlink(join(this.gitdir, 'index'));
      await igCheckout({ fs, dir: this.path, ref: ref as string });
    }
  }

  isBare() {
    return this.bare;
  }
}

export class Commit {
  static async create(repo: Repository, commitOpts: CommitOpts, tree: Tree, parents: Commit[]): Promise<Oid> {
    let sha = await igCommit(
      Object.assign(formatCommitOpts(commitOpts), {
        fs,
        gitdir: repo.gitdir,
        tree: tree.id()!.toString(),
        parent: parents.map(p => p.sha()),
        noUpdateBranch: true,
      })
    );
    return new Oid(sha);
  }

  static async lookup(repo: Repository, id: Oid | string): Promise<Commit> {
    try {
      let commitInfo = await igReadCommit({
        fs,
        gitdir: repo.gitdir,
        oid: id.toString(),
      });
      return new Commit(repo, commitInfo);
    } catch (e) {
      if (e.code == 'ReadObjectFail') {
        throw new UnknownObjectId();
      } else {
        throw e;
      }
    }
  }

  constructor(private readonly repo: Repository, private readonly commitInfo: ReadCommitResult) {}

  id() {
    return new Oid(this.commitInfo.oid);
  }

  sha() {
    return this.commitInfo.oid;
  }

  async getLog() {
    return await igLog({
      fs,
      gitdir: this.repo.gitdir,
      ref: this.sha(),
    });
  }

  async getTree() {
    return await Tree.lookup(this.repo, new Oid(this.commitInfo.commit.tree));
  }
}

export class Oid {
  constructor(public readonly sha: string) {}

  toString() {
    return this.sha;
  }

  equal(other: Oid | string | undefined) {
    return other && other.toString() === this.toString();
  }
}
export class RepoNotFound extends Error {}
export class BranchNotFound extends Error {}
export class GitConflict extends Error {}
export class UnknownObjectId extends Error {}

class Reference {
  constructor(private readonly repo: Repository, private readonly reference: string, private readonly sha: string) {}

  static async lookup(repo: Repository, reference: string) {
    let sha = await igResolveRef({
      fs,
      gitdir: repo.gitdir,
      ref: reference,
    });

    return new Reference(repo, reference, sha);
  }

  target() {
    return new Oid(this.sha);
  }

  async setTarget(id: Oid): Promise<void> {
    await igWriteRef({
      fs,
      gitdir: this.repo.gitdir,
      ref: this.reference,
      value: id.toString(),
      force: true,
    });
  }

  toString() {
    return this.reference;
  }
}

export class Remote {
  static async create(repo: Repository, remote: string, url: string): Promise<Remote> {
    await igAddRemote({
      fs,
      gitdir: await repo.gitdir,
      remote,
      url,
    });

    return new Remote(repo, remote);
  }

  constructor(private readonly repo: Repository, private readonly remote: string) {}

  async push(ref: string, remoteRef: string, options: PushOptions = {}): Promise<void> {
    await igPush(
      Object.assign(
        {
          fs,
          http,
          gitdir: await this.repo.gitdir,
          remote: this.remote,
          ref,
          remoteRef,
        },
        options
      )
    );
  }
}

function formatCommitOpts(commitOpts: CommitOpts) {
  let commitDate = moment(commitOpts.authorDate || new Date());

  let author = {
    name: commitOpts.authorName,
    email: commitOpts.authorEmail,
    timestamp: commitDate.unix(),
    timezoneOffset: -commitDate.utcOffset(),
  };

  let committer;

  if (commitOpts.committerName && commitOpts.committerEmail) {
    committer = {
      name: commitOpts.committerName,
      email: commitOpts.committerEmail,
    };
  }

  return {
    author,
    committer,
    message: commitOpts.message,
  };
}

export class Merge {
  static FASTFORWARD_ONLY = 2;

  static async base(repo: Repository, one: Oid, two: Oid): Promise<Oid> {
    let oids = await igFindMergeBase({
      fs,
      gitdir: repo.gitdir,
      oids: [one.toString(), two.toString()],
    });
    return new Oid(oids[0]);
  }

  static async perform(repo: Repository, ourCommit: Commit, theirCommit: Commit, commitOpts: CommitOpts) {
    try {
      let res = await igMerge(
        Object.assign(formatCommitOpts(commitOpts), {
          fs,
          gitdir: repo.gitdir,
          ours: ourCommit.sha(),
          theirs: theirCommit.sha(),
        })
      );

      return res;
    } catch (e) {
      if (e.code === 'MergeNotSupportedError') {
        throw new GitConflict();
      } else {
        throw e;
      }
    }
  }
}
