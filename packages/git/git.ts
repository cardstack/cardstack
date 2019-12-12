import {
  Branch as NGBranch,
  Clone as NGClone,
  Commit as NGCommit,
  Cred as NGCred,
  Merge as NGMerge,
  Oid as NGOid,
  Remote as NGRemote,
  Repository as NGRepository,
  Reference as NGReference,
  Index as NGIndex,
  Reset as NGReset,
  Signature as NGSignature,
  Tree as NGTree,
  Treebuilder as NGTreebuilder,
  TreeEntry as NGTreeEntry,
  Blob as NGBlob,
} from 'nodegit';

import { FetchOptions as NGFetchOptions } from 'nodegit/fetch-options';

// import fs from 'fs';
// import IsomorphicGit from 'isomorphic-git';
// IsomorphicGit.plugins.set('fs', fs);

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
// const { setThreadSafetyStatus } = require('nodegit');
// This is supposed to enable thread-safe locking around all async
// operations.
// setThreadSafetyStatus(1);

export interface RemoteConfig {
  url: string;
  privateKey: string;
  cacheDir: string;
  publicKey: string;
  passphrase: string;
}

import { Moment } from 'moment-timezone';

export interface CommitOpts {
  authorDate?: Moment;
  authorEmail: string;
  authorName: string;
  message: string;
  committerName?: string;
  committerEmail?: string;
}

export class Repository {
  static async open(path: string) {
    let ngrepo = await NGRepository.open(path);
    return new Repository(ngrepo);
  }

  static async init(path: string, isBare: boolean) {
    let ngrepo = await NGRepository.init(path, isBare ? 1 : 0);
    return new Repository(ngrepo);
  }

  static async clone(url: string, path: string, { fetchOpts }: { fetchOpts: FetchOptions }) {
    let ngrepo = await NGClone.clone(url, path, { fetchOpts: fetchOpts.toNgFetchOptions() });
    return new Repository(ngrepo);
  }

  constructor(private readonly ngrepo: NGRepository) {}

  path() {
    return this.ngrepo.path();
  }

  async getMasterCommit(): Promise<Commit> {
    return new Commit(await this.ngrepo.getMasterCommit());
  }

  async fetch(remote: string, fetchOpts: FetchOptions): Promise<void> {
    await this.ngrepo.fetch(remote, fetchOpts.toNgFetchOptions());
  }

  async getRemote(remote: string): Promise<Remote> {
    return new Remote(await this.ngrepo.getRemote(remote));
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

  async createBranch(targetBranch: string, headCommit: Commit, force: boolean): Promise<Reference> {
    let ngreference = await this.ngrepo.createBranch(targetBranch, headCommit.getNgCommit(), force);
    return new Reference(ngreference);
  }

  async checkoutBranch(reference: Reference) {
    await this.ngrepo.checkoutBranch(reference.getNgReference());
  }

  async getHeadCommit() {
    let ngcommit = await this.ngrepo.getHeadCommit();
    return new Commit(ngcommit);
  }

  async getReferenceCommit(name: string): Promise<Commit> {
    let ngcommit = await this.ngrepo.getReferenceCommit(name);
    return new Commit(ngcommit);
  }

  isBare() {
    return !!this.ngrepo.isBare();
  }

  getNgRepo() {
    return this.ngrepo;
  }
}

export class Commit {
  static async create(
    repo: Repository,
    updateRef: string | null,
    author: Signature,
    committer: Signature,
    messageEncoding: string,
    message: string,
    tree: Tree,
    parentCount: number,
    parents: Commit[]
  ): Promise<Oid> {
    let ngoid = await NGCommit.create(
      repo.getNgRepo(),
      (updateRef as unknown) as string,
      author.getNgSignature(),
      committer.getNgSignature(),
      messageEncoding,
      message,
      tree.getNgTree(),
      parentCount,
      parents.map(p => p.getNgCommit())
    );

    return Oid.fromNGOid(ngoid);
  }

  static async lookup(repo: Repository, id: Oid | string): Promise<Commit> {
    let ngcommit = await NGCommit.lookup(repo.getNgRepo(), id.toString());
    return new Commit(ngcommit);
  }

  constructor(private readonly ngcommit: NGCommit) {}

  id() {
    return Oid.fromNGOid(this.ngcommit.id());
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

export class Branch {
  static LOCAL = 1;
  static REMOTE = 2;
  static ALL = 3;

  static async lookup(repo: Repository, branchName: string, branchType: number): Promise<Reference> {
    let ngreference = await NGBranch.lookup(repo.getNgRepo(), branchName, branchType);
    return new Reference(ngreference);
  }

  static async create(repo: Repository, branchName: string, target: Commit, force: boolean): Promise<Reference> {
    let ngreference = await NGBranch.create(repo.getNgRepo(), branchName, target.getNgCommit(), force ? 1 : 0);
    return new Reference(ngreference);
  }

  constructor(private readonly ngbranch: NGBranch) {}
}

class Reference {
  constructor(private readonly ngreference: NGReference) {}

  target() {
    return Oid.fromNGOid(this.ngreference.target());
  }

  async setTarget(id: Oid, logMessage: string): Promise<void> {
    await this.ngreference.setTarget(id.toNGOid(), logMessage);
  }

  getNgReference() {
    return this.ngreference;
  }
}

export class Remote {
  static async create(repo: Repository, name: string, url: string): Promise<Remote> {
    let ngremote = await NGRemote.create(repo.getNgRepo(), name, url);
    return new Remote(ngremote);
  }

  constructor(private readonly ngremote: NGRemote) {}

  async push(refSpecs: string[], fetchOpts?: FetchOptions): Promise<void> {
    await this.ngremote.push(refSpecs, fetchOpts && fetchOpts.toNgFetchOptions());
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

export class Merge {
  static FASTFORWARD_ONLY = 2;

  static async base(repo: Repository, one: Oid, two: Oid): Promise<Oid> {
    let ngoid = await NGMerge.base(repo.getNgRepo(), one.toNGOid(), two.toNGOid());
    return Oid.fromNGOid(ngoid);
  }

  static async commits(repo: Repository, ourCommit: Commit, theirCommit: Commit): Promise<Index> {
    let ngindex = await NGMerge.commits(repo.getNgRepo(), ourCommit.getNgCommit(), theirCommit.getNgCommit());
    return new Index(ngindex);
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
  constructor(private readonly credentialsCallback: (url: string, userName: string) => Promise<Cred> | Cred) {}

  toNgFetchOptions(): NGFetchOptions {
    return {
      callbacks: {
        credentials: async (url: string, userName: string) =>
          (await this.credentialsCallback(url, userName)).getNgCred(),
      },
    };
  }
}
