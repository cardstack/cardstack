import { Repository, RemoteConfig, GitConflict, UnknownObjectId, Commit } from './lib/git';
import Tree, { FileNotFound, OverwriteRejected, TreeEntry } from './lib/tree';

import { todo } from './lib/todo-any';

import crypto from 'crypto';
import Change from './lib/change';
import os from 'os';
import process from 'process';
import CardstackError from '@cardstack/core/error';
import { dir as mkTmpDir } from 'tmp-promise';
import { MetaObject } from 'jsonapi-typescript';
import { extractSettings } from './lib/git-settings';

import { Writer } from '@cardstack/core/writer';
import { Session } from '@cardstack/core/session';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/document';
import { inject } from '@cardstack/hub/dependency-injection';
import { AddressableCard } from '@cardstack/core/card';
import { writeCard } from '@cardstack/core/card-file';
import { upstreamIdToCardDirName } from '@cardstack/core/card-id';

const defaultBranch = 'master';

export default class GitWriter implements Writer {
  cards = inject('cards');

  myEmail: string;
  myName: string;
  remote?: RemoteConfig;
  repoPath?: string;
  basePath?: string;
  repo?: Repository;
  branchPrefix = '';
  githereumConfig: todo;
  githereum: todo;
  _githereumPromise?: Promise<todo>;

  constructor(private realmCard: AddressableCard) {
    let hostname = os.hostname();
    this.myName = `PID${process.pid} on ${hostname}`;
    this.myEmail = `${os.userInfo().username}@${hostname}`;
  }

  async ready(): Promise<void> {
    let settings = await extractSettings(this.realmCard);
    this.repoPath = settings.repo;
    this.basePath = settings.basePath;
    this.branchPrefix = settings.branchPrefix;
    this.remote = settings.remote;
  }

  async create(session: Session, document: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let cardDirName: string;
    if (!upstreamId) {
      cardDirName = upstreamIdToCardDirName(await this.generateId());
      if (!document.jsonapi.data.attributes) {
        document.jsonapi.data.attributes = Object.create(null);
      }
      document.jsonapi.data.attributes!.csId = cardDirName;
    } else {
      cardDirName = upstreamIdToCardDirName(upstreamId);
      if (!document.jsonapi.data.attributes) {
        document.jsonapi.data.attributes = Object.create(null);
      }
      document.jsonapi.data.attributes!.csId = typeof upstreamId === 'string' ? upstreamId : upstreamId.csId;
      if (typeof upstreamId === 'object' && upstreamId.csOriginalRealm != null) {
        document.jsonapi.data.attributes!.csOriginalRealm = upstreamId.csOriginalRealm;
      }
    }

    let cardDir = this.cardDirectoryFor(cardDirName);
    return withErrorHandling(cardDir, async () => {
      await this.ensureRepo();
      let change = await Change.create(this.repo!, null, this.branchPrefix + defaultBranch, !!this.remote);

      await writeCard(cardDir, document.jsonapi, async (path: string, content: string) => {
        let file = await change.get(path, { allowCreate: true });
        file.setContent(content);
      });

      let signature = await this._commitOptions('create', cardDirName, session);
      let version = await change.finalize(signature);
      let meta: MetaObject | undefined;

      meta = Object.assign({}, document.jsonapi.data.meta);
      meta.version = version;
      document.jsonapi.data.meta = meta;

      return { saved: document, version, id: upstreamId ?? cardDirName };
    });
  }

  async update(session: Session, id: UpstreamIdentity, document: UpstreamDocument): Promise<UpstreamDocument> {
    let cardDirName = upstreamIdToCardDirName(id);

    let meta = document.jsonapi.data.meta;

    let version = meta?.version;
    if (version == null) {
      throw new CardstackError('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }
    await this.ensureRepo();

    let cardDir = this.cardDirectoryFor(cardDirName);
    return withErrorHandling(cardDir, async () => {
      let change = await Change.create(this.repo!, version as string, this.branchPrefix + defaultBranch, !!this.remote);

      await this.deleteCardTree(cardDir, change);
      await writeCard(cardDir, document.jsonapi, async (path: string, content: string) => {
        let file = await change.get(path, { allowCreate: true, allowUpdate: true });
        file.setContent(content);
      });

      let signature = await this._commitOptions('update', cardDirName, session);
      version = await change.finalize(signature);

      meta = Object.assign({}, document.jsonapi.data.meta);
      meta.version = version;
      document.jsonapi.data.meta = meta;

      return document;
    });
  }

  async delete(session: Session, id: UpstreamIdentity, version: string) {
    let cardDirName = upstreamIdToCardDirName(id);
    let cardDir = this.cardDirectoryFor(cardDirName);

    if (!version) {
      throw new CardstackError('version is required', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    await this.ensureRepo();
    return withErrorHandling(cardDir, async () => {
      let change = await Change.create(this.repo!, version, this.branchPrefix + defaultBranch, !!this.remote);

      await this.deleteCardTree(cardDir, change);
      let signature = await this._commitOptions('delete', cardDirName, session);
      await change.finalize(signature);
    });
  }

  async _commitOptions(operation: string, id: string, session: Session) {
    if (!session.unimplementedSession) {
      throw new CardstackError('Session not implemented');
    }
    // TODO use user session data when we add that capability
    return {
      authorName: 'Anonymous Coward',
      authorEmail: 'anon@example.com',
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `${operation} ${String(id).slice(12)}`,
    };
  }

  private async rootTree(): Promise<Tree | undefined> {
    await this.ensureRepo();
    if (!this.repo) {
      return;
    }
    let branchName = this.branchPrefix + defaultBranch;
    let branch = await this.repo.lookupLocalBranch(branchName);
    let headCommit = await Commit.lookup(this.repo, branch.target());
    return await headCommit.getTree();
  }

  private async cardTree(cardDir: string): Promise<Tree | undefined> {
    let cardTree = await this.rootTree();
    if (!cardTree) {
      return;
    }

    let cardDirSegments = cardDir.split('/');
    while (cardTree && cardDirSegments.length) {
      let entry: TreeEntry | undefined = cardTree.entryByName(cardDirSegments.shift()!);
      if (!entry || !entry.isTree()) {
        return;
      }
      cardTree = await entry.getTree();
    }
    return cardTree;
  }

  private async deleteCardTree(cardDir: string, change: Change): Promise<void> {
    let cardTree = await this.cardTree(cardDir);
    if (!cardTree) {
      return;
    }

    await this.deleteTree(cardTree, change);
  }

  private async deleteTree(tree: Tree, change: Change) {
    for (let entry of tree.entries()) {
      if (entry.isTree()) {
        await this.deleteTree(await entry.getTree(), change);
      } else {
        let file = await change.get(entry.path());
        file.delete();
      }
    }
  }

  private cardDirectoryFor(cardDir: string) {
    let base = this.basePath ? this.basePath + '/' : '';
    let start: string;

    if (base) {
      start = `${base}/`;
    } else {
      start = '';
    }
    return `${start}cards/${cardDir}`;
  }

  private async ensureRepo() {
    if (!this.repo) {
      if (this.remote) {
        let tempRepoPath = (await mkTmpDir()).path;
        this.repo = await Repository.clone(this.remote.url, tempRepoPath);
        return;
      }

      this.repo = await Repository.open(this.repoPath!);
    }
  }

  private async generateId() {
    let rootTree = await this.rootTree();
    if (!rootTree) {
      throw new Error(`Could not generate card ID because there is no repo for this git realm`);
    }

    while (true) {
      let id = crypto.randomBytes(20).toString('hex');
      let cardTree = await this.cardTree(this.cardDirectoryFor(id));
      if (!cardTree) {
        return id;
      }
    }
  }
}

async function withErrorHandling(cardDir: string | undefined, fn: Function) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnknownObjectId) {
      throw new CardstackError(err.message, { status: 400, source: { pointer: '/data/meta/version' } });
    }
    if (err instanceof GitConflict) {
      throw new CardstackError('Merge conflict', { status: 409 });
    }
    if (err instanceof OverwriteRejected) {
      throw new CardstackError(`The cardDir ${cardDir} is already in use`, {
        status: 409,
        source: { pointer: '/data/id' },
      });
    }
    if (err instanceof FileNotFound) {
      throw new CardstackError(`The cardDir ${cardDir} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' },
      });
    }
    throw err;
  }
}
