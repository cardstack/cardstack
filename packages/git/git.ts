import {
  Cred as NGCred,
  Oid as NGOid,
  Repository as NGRepository,
  Index as NGIndex,
  Reset as NGReset,
  Signature as NGSignature,
  Tree as NGTree,
  Treebuilder as NGTreebuilder,
  TreeEntry as NGTreeEntry,
  Blob as NGBlob,
  Commit as NGCommit,
} from 'nodegit';

import { FetchOptions as NGFetchOptions } from 'nodegit/fetch-options';

import fs from 'fs';
import {
  addRemote as igAddRemote,
  clone as igClone,
  commit as igCommit,
  findMergeBase as igFindMergeBase,
  init as igInit,
  listBranches as igListBranches,
  merge as igMerge,
  plugins as igPlugins,
  push as igPush,
  resolveRef as igResolveRef,
  writeRef as igWriteRef,
} from 'isomorphic-git';

igPlugins.set('fs', fs);

export const enum FILEMODE {
  UNREADABLE = 0,
  TREE = 16384,
  BLOB = 33188,
  EXECUTABLE = 33261,
  LINK = 40960,
  COMMIT = 57344,
}

// there is no type for this
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { setThreadSafetyStatus } = require('nodegit');
// This is supposed to enable thread-safe locking around all async
// operations.
setThreadSafetyStatus(1);

export interface RemoteConfig {
  url: string;
  privateKey: string;
  cacheDir: string;
  publicKey: string;
  passphrase: string;
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
  static async open(path: string, bare = false) {
    let ngrepo = bare ? await NGRepository.openBare(path) : await NGRepository.open(path);
    return new Repository(ngrepo);
  }

  static async initBare(gitdir: string): Promise<Repository> {
    await igInit({ gitdir, bare: true });
    return await Repository.open(gitdir, true);
  }

  static async clone(url: string, dir: string) {
    await igClone({
      url,
      dir,
    });
    return await Repository.open(dir);
  }

  constructor(private readonly ngrepo: NGRepository) {}

  path() {
    return this.ngrepo.path();
  }

  gitdir() {
    return this.ngrepo.path();
  }

  async getMasterCommit(): Promise<Commit> {
    return new Commit(await this.ngrepo.getMasterCommit());
  }

  async fetch(remote: string, fetchOpts: FetchOptions): Promise<void> {
    await this.ngrepo.fetch(remote, fetchOpts.toNgFetchOptions());
  }

  async getRemote(remote: string): Promise<Remote> {
    return new Remote(this, remote);
  }

  async createBlobFromBuffer(buffer: Buffer): Promise<Oid> {
    return Oid.fromNGOid(await this.ngrepo.createBlobFromBuffer(buffer));
  }

  async fetchAll(fetchOpts?: FetchOptions) {
    await this.ngrepo.fetchAll(fetchOpts && fetchOpts.toNgFetchOptions());
  }

  async mergeBranches(to: string, from: string, ignored: null, preference: number) {
    await this.ngrepo.mergeBranches(to, from, undefined, preference);
  }

  async getReference(branchName: string) {
    await this.ngrepo.getReference(branchName);
  }

  async createBranch(targetBranch: string, headCommit: Commit): Promise<Reference> {
    let ngreference = await this.ngrepo.createBranch(targetBranch, headCommit.getNgCommit());
    return await Reference.lookup(this, ngreference.toString());
  }

  async checkoutBranch(reference: Reference) {
    await this.ngrepo.checkoutBranch(reference.toString());
  }

  async getHeadCommit() {
    let ngcommit = await this.ngrepo.getHeadCommit();
    return new Commit(ngcommit);
  }

  async getReferenceCommit(name: string): Promise<Commit> {
    let ngcommit = await this.ngrepo.getReferenceCommit(name);
    return new Commit(ngcommit);
  }

  async lookupLocalBranch(branchName: string) {
    let branches = await igListBranches({ gitdir: this.gitdir() });

    if (branches.includes(branchName)) {
      return await this.lookupReference(`refs/heads/${branchName}`);
    } else {
      throw new BranchNotFound();
    }
  }

  async lookupRemoteBranch(remote: string, branchName: string) {
    let branches = await igListBranches({ gitdir: this.gitdir(), remote });

    if (branches.includes(branchName)) {
      return await this.lookupReference(`refs/remotes/${remote}/${branchName}`);
    } else {
      throw new BranchNotFound();
    }
  }

  async lookupReference(reference: string) {
    return await Reference.lookup(this, reference);
  }

  isBare() {
    return !!this.ngrepo.isBare();
  }

  getNgRepo() {
    return this.ngrepo;
  }
}

export class Commit {
  static async create(repo: Repository, commitOpts: CommitOpts, tree: Tree, parents: Commit[]): Promise<Oid> {
    let sha = await igCommit(
      Object.assign(formatCommitOpts(commitOpts), {
        gitdir: repo.gitdir(),
        tree: tree.id().toString(),
        parent: parents.map(p => p.sha()),
        noUpdateBranch: true,
      })
    );
    return new Oid(sha);
  }

  static async lookup(repo: Repository, id: Oid | string): Promise<Commit> {
    let ngcommit = await NGCommit.lookup(repo.getNgRepo(), id.toString());
    return new Commit(ngcommit);
  }

  constructor(private readonly ngcommit: NGCommit) {}

  id() {
    return Oid.fromNGOid(this.ngcommit.id());
  }

  sha() {
    return this.ngcommit.id().toString();
  }

  async getLog() {
    let log: Commit[] = [];

    await new Promise((resolve, reject) => {
      let history = this.ngcommit.history();
      history.on('commit', (c: any) => log.push(new Commit(c)));
      history.on('end', resolve);
      history.on('error', reject);
      history.start();
    });

    return log;
  }

  getNgCommit() {
    return this.ngcommit;
  }

  async getTree() {
    let ngtree = await this.ngcommit.getTree();
    return new Tree(ngtree);
  }
}

export class Oid {
  constructor(private readonly sha: string) {}

  static fromNGOid(oid: NGOid) {
    return new Oid(oid.tostrS());
  }

  toString() {
    return this.sha;
  }

  tostrS() {
    return this.sha;
  }

  toNGOid() {
    return NGOid.fromString(this.toString());
  }

  equal(other: Oid | string) {
    return other.toString() === this.toString();
  }
}
export class BranchNotFound extends Error {}
export class GitConflict extends Error {}

class Reference {
  constructor(private readonly repo: Repository, private readonly reference: string, private readonly sha: string) {}

  static async lookup(repo: Repository, reference: string) {
    let sha = await igResolveRef({
      gitdir: repo.gitdir(),
      ref: reference,
    });

    return new Reference(repo, reference, sha);
  }

  target() {
    return new Oid(this.sha);
  }

  async setTarget(id: Oid): Promise<void> {
    await igWriteRef({
      gitdir: this.repo.gitdir(),
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
      gitdir: await repo.gitdir(),
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
          gitdir: await this.repo.gitdir(),
          remote: this.remote,
          ref,
          remoteRef,
        },
        options
      )
    );
  }
}

export class Tree {
  static async lookup(repo: Repository, oid: Oid) {
    let ngtree = await NGTree.lookup(repo.getNgRepo(), oid.toNGOid());
    return new Tree(ngtree);
  }
  constructor(private readonly ngtree: NGTree) {}

  id() {
    return Oid.fromNGOid(this.ngtree.id());
  }

  getNgTree() {
    return this.ngtree;
  }

  entries() {
    return this.ngtree.entries().map(e => new TreeEntry(e));
  }

  entryByName(name: string) {
    // This is apparently private API. There's unfortunately no public
    // API for gracefully attempting to retriee and entry that may be
    // absent.
    let entry,
      ngentry = this.ngtree._entryByName(name);
    if (ngentry) {
      // @ts-ignore this is a hack
      ngentry.parent = this.ngtree;
      entry = new TreeEntry(ngentry);
    }
    return entry;
  }
}

function formatCommitOpts(commitOpts: CommitOpts) {
  let commitDate = moment(commitOpts.authorDate || new Date());

  let author = {
    name: commitOpts.authorName,
    email: commitOpts.authorEmail,
    date: commitDate.toDate(),
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
      gitdir: repo.gitdir(),
      oids: [one.toString(), two.toString()],
    });
    return new Oid(oids[0]);
  }

  static async perform(repo: Repository, ourCommit: Commit, theirCommit: Commit, commitOpts: CommitOpts) {
    try {
      let res = await igMerge(
        Object.assign(formatCommitOpts(commitOpts), {
          gitdir: repo.gitdir(),
          ours: ourCommit.sha(),
          theirs: theirCommit.sha(),
        })
      );

      return res;
    } catch (e) {
      if (e.code === 'MergeNotSupportedFail') {
        throw new GitConflict();
      } else {
        throw e;
      }
    }
  }
}

export class Index {
  constructor(private readonly ngindex: NGIndex) {}

  hasConflicts(): boolean {
    return this.ngindex.hasConflicts();
  }

  async writeTreeTo(repo: Repository) {
    let ngoid = await this.ngindex.writeTreeTo(repo.getNgRepo());
    return Oid.fromNGOid(ngoid);
  }
}

export class Treebuilder {
  static async create(repo: Repository, tree: Tree | undefined) {
    let ngtreebuilder = await NGTreebuilder.create(repo.getNgRepo(), tree && tree.getNgTree());
    return new Treebuilder(ngtreebuilder);
  }

  constructor(private readonly ngtreebuilder: NGTreebuilder) {}

  remove(filename: string) {
    this.ngtreebuilder.remove(filename);
  }

  async insert(filename: string, childId: Oid, filemode: FILEMODE) {
    await this.ngtreebuilder.insert(filename, childId.toNGOid(), filemode);
  }

  entrycount() {
    return this.ngtreebuilder.entrycount();
  }

  async write(): Promise<Oid> {
    let ngoid = await this.ngtreebuilder.write();
    return Oid.fromNGOid(ngoid);
  }
}

export class Blob {
  constructor(private readonly ngblob: NGBlob) {}

  id() {
    return Oid.fromNGOid(this.ngblob.id());
  }

  content(): Buffer {
    return this.ngblob.content();
  }
}

export class TreeEntry {
  constructor(private readonly ngtreeentry: NGTreeEntry) {}

  isTree() {
    return this.ngtreeentry.isTree();
  }

  filemode() {
    return (this.ngtreeentry.filemode() as unknown) as FILEMODE;
  }

  path() {
    return this.ngtreeentry.path();
  }

  id() {
    return Oid.fromNGOid(this.ngtreeentry.id());
  }

  async getBlob(): Promise<Blob> {
    return new Blob(await this.ngtreeentry.getBlob());
  }

  isBlob(): boolean {
    return this.ngtreeentry.isBlob();
  }

  name(): string {
    return this.ngtreeentry.name();
  }

  async getTree() {
    let tree = await this.ngtreeentry.getTree();
    if (tree) {
      return new Tree(tree);
    }
  }
}

export class Reset {
  static HARD = 3;
  static async hardReset(repo: Repository, target: Commit) {
    await NGReset.reset(repo.getNgRepo(), target.getNgCommit(), Reset.HARD, {});
  }
}

export class Signature {
  static create(name: string, email: string, unixDate: number, utcOffset: number) {
    let ngsignature = NGSignature.create(name, email, unixDate, utcOffset);
    return new Signature(ngsignature);
  }

  constructor(private readonly ngsignature: NGSignature) {}

  getNgSignature() {
    return this.ngsignature;
  }
}

export class Cred {
  static async sshKeyMemoryNew(username: string, publicKey: string, privateKey: string, passphrase: string) {
    let ngcred = await NGCred.sshKeyMemoryNew(username, publicKey, privateKey, passphrase);
    return new Cred(ngcred);
  }

  static sshKeyFromAgent(username: string) {
    let ngcred = NGCred.sshKeyFromAgent(username);
    return new Cred(ngcred);
  }

  constructor(private readonly ngcred: NGCred) {}

  getNgCred() {
    return this.ngcred;
  }
}

export class FetchOptions {
  constructor(private readonly credentialsCallback: (userName: string) => Promise<Cred> | Cred) {}

  static privateKey(privateKey: string, publicKey = '', passphrase = '') {
    return new FetchOptions(userName => Cred.sshKeyMemoryNew(userName, publicKey, privateKey, passphrase));
  }

  static agentKey() {
    return new FetchOptions(userName => Cred.sshKeyFromAgent(userName));
  }

  toNgFetchOptions(): NGFetchOptions {
    return {
      callbacks: {
        credentials: async (url: string, userName: string) => {
          let cred = await this.credentialsCallback(userName);
          return cred.getNgCred();
        },
      },
    };
  }
}
