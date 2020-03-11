import { Repository, RemoteConfig, GitConflict, UnknownObjectId } from './lib/git';
import { FileNotFound, OverwriteRejected } from './lib/tree';

import { todo } from './lib/todo-any';

import crypto from 'crypto';
import Change, { FileHandle } from './lib/change';
import os from 'os';
import process from 'process';
import CardstackError from '@cardstack/core/error';
import { dir as mkTmpDir } from 'tmp-promise';
import { MetaObject } from 'jsonapi-typescript';
import { extractSettings } from './lib/git-settings';
// import { PrimaryData } from 'jsonapi-typescript';

import { Writer } from '@cardstack/core/writer';
import { Session } from '@cardstack/core/session';
import { UpstreamDocument, UpstreamIdentity, upstreamIdToCardId, upstreamIdToString } from '@cardstack/core/document';
import { inject } from '@cardstack/hub/dependency-injection';
import { AddressableCard } from '@cardstack/core/card';
import { writeCard } from '@cardstack/core/card-file';

// import { Session } from '@cardstack/core/session';
// import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/document';
// import { inject } from '@cardstack/hub/dependency-injection';
// import { AddressableCard } from '@cardstack/core/card';
// import CardstackError from '@cardstack/core/error';

// let counter = 0;

// export default class EphemeralWriter implements Writer {
//   ephemeralStorage = inject('ephemeralStorage');

//   constructor(private realmCard: AddressableCard) {}

//   async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
//     let id = upstreamId ?? String(counter++);
//     let saved = this.ephemeralStorage.store(doc, id, this.realmCard.csId);
//     return { saved: saved!, id };
//   }

//   async update(_session: Session, id: UpstreamIdentity, doc: UpstreamDocument) {
//     let version = doc.jsonapi.data.meta?.version;
//     if (version == null) {
//       throw new CardstackError('missing required field "meta.version"', {
//         status: 400,
//         source: { pointer: '/data/meta/version' },
//       });
//     }

//     return this.ephemeralStorage.store(doc, id, this.realmCard.csId, String(version))!;
//   }

//   async delete(_session: Session, id: UpstreamIdentity, version: string | number) {
//     this.ephemeralStorage.store(null, id, this.realmCard.csId, version);
//   }
// }

const defaultBranch = 'master';

const type = 'cards';

function getId(document: UpstreamDocument) {
  return document.jsonapi.data.id;
}

// function getMeta(model: todo) {
//   return model.data ? model.data.meta : model.meta;
// }

// interface WriterConfig {
//   repo: string;
//   basePath?: string;
//   branchPrefix?: string;
//   remote?: RemoteConfig;
// }

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
    let createId = upstreamId || getId(document);
    let id: string | undefined;

    if (createId) {
      id = upstreamIdToString(createId);
    }

    // let cardId: UpstreamIdentity | undefined;
    // if (id) {
    //   cardId = upstreamIdToCardId(id, this.realmCard.csId).csId;
    // }

    return withErrorHandling(id, type, async () => {
      await this._ensureRepo();
      let change = await Change.create(this.repo!, null, this.branchPrefix + defaultBranch, !!this.remote);

      let file: FileHandle;
      while (id == null) {
        let candidateId = this._generateId();
        let candidateFile = await change.get(`${this._cardDirectoryFor(type, candidateId)}/card.json`, {
          allowCreate: true,
        });
        if (!candidateFile.exists()) {
          id = candidateId;
          file = candidateFile;
        }
      }

      document.jsonapi.data.attributes!.csId = id;
      let cardJsonFileName = `${this._cardDirectoryFor(type, id)}/card.json`;

      await writeCard(this._cardDirectoryFor(type, id), document.jsonapi, async (path: string, content: string) => {
        let cardFile;
        if (file && path === cardJsonFileName) {
          cardFile = file;
        } else {
          cardFile = await change.get(path, { allowCreate: true });
        }
        cardFile.setContent(content);
      });

      let signature = await this._commitOptions('create', type, id, session);
      let version = await change.finalize(signature);
      let meta: MetaObject | undefined;

      meta = Object.assign({}, document.jsonapi.data.meta);
      meta.version = version;
      document.jsonapi.data.meta = meta;

      return { saved: document, version, id };
    });
  }

  // async finalize(pendingChange: todo) {
  //   let { id, type, change, file, signature } = pendingChange;
  //   return withErrorHandling(id, type, async () => {
  //     if (file) {
  //       if (pendingChange.finalDocument) {
  //         // use stringify library instead of JSON.stringify, since JSON's method
  //         // is non-deterministic and could produce unnecessary diffs
  //         file.setContent(
  //           stringify({
  //             attributes: pendingChange.finalDocument.attributes,
  //             relationships: pendingChange.finalDocument.relationships,
  //           })
  //         );
  //       } else {
  //         file.delete();
  //       }
  //     }
  //     let version = await change.finalize(signature, this.remote);
  //     return { version, hash: file ? file.savedId() : null };
  //   });
  // }

  async update(session: Session, id: UpstreamIdentity, document: UpstreamDocument): Promise<UpstreamDocument> {
    let cardId = upstreamIdToCardId(id, this.realmCard.csId).csId;

    let meta = document.jsonapi.data.meta;

    let version = meta?.version;
    if (version == null) {
      throw new CardstackError('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    // return this.ephemeralStorage.store(doc, id, this.realmCard.csId, String(version))!;
    // }

    // async prepareUpdate(session: Session, type: string, id: string, document: todo, isSchema: boolean) {

    await this._ensureRepo();

    return withErrorHandling(cardId, type, async () => {
      let change = await Change.create(this.repo!, version as string, this.branchPrefix + defaultBranch, !!this.remote);

      let cardDir = this._cardDirectoryFor(type, cardId);
      await writeCard(cardDir, document.jsonapi, async (path: string, content: string) => {
        let file = await change.get(path, { allowCreate: true, allowUpdate: true });
        file.setContent(content);
      });

      let signature = await this._commitOptions('update', type, cardId, session);
      version = await change.finalize(signature);

      meta = Object.assign({}, document.jsonapi.data.meta);
      meta.version = version;
      document.jsonapi.data.meta = meta;

      return document;

      // before.id = id;
      // before.type = type;
      // after.id = document.id;
      // after.type = document.type;
      // return {
      //   originalDocument: before,
      //   finalDocument: after,
      //   finalizer: finalizer.bind(this),
      //   type,
      //   id,
      //   signature,
      //   change,
      //   file,
      // };
    });
  }

  async delete(session: Session, id: UpstreamIdentity, version: string) {
    let cardId = upstreamIdToCardId(id, this.realmCard.csId);

    let card = await this.cards.as(session).get(cardId);

    let jsonApiDoc = await card.serializeAsJsonAPIDoc();
    let type = jsonApiDoc.data.type;

    // async prepareDelete(session: Session, version: string, type: string, id: string, isSchema: boolean) {
    if (!version) {
      throw new CardstackError('version is required', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    await this._ensureRepo();
    return withErrorHandling(cardId.csId, type, async () => {
      let change = await Change.create(this.repo!, version, this.branchPrefix + defaultBranch, !!this.remote);

      let file = await change.get(this._cardDirectoryFor(type, cardId.csId));
      file.delete();
      let signature = await this._commitOptions('delete', type, cardId.csId, session);
      await change.finalize(signature);
    });
  }

  async _commitOptions(operation: string, type: string, id: string, session: Session) {
    if (!session.unimplementedSession) {
      throw new CardstackError('Session not implemented');
      // let user = await session.loadUser();
      // let userAttributes = (user && user.data && user.data.attributes) || {};
    }

    // return {
    //   authorName: userAttributes['full-name'] || userAttributes.name || 'Anonymous Coward',
    //   authorEmail: userAttributes.email || 'anon@example.com',
    //   committerName: this.myName,
    //   committerEmail: this.myEmail,
    //   message: `${operation} ${type} ${String(id).slice(12)}`,
    // };
    return {
      authorName: 'Anonymous Coward',
      authorEmail: 'anon@example.com',
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `${operation} ${type} ${String(id).slice(12)}`,
    };
  }

  _cardDirectoryFor(type: string, id: string) {
    let base = this.basePath ? this.basePath + '/' : '';
    let encodedId = encodeURIComponent(id);
    let start: string;

    if (base) {
      start = `${base}/`;
    } else {
      start = '';
    }
    return `${start}${type}/${encodedId}`;
  }

  async _ensureRepo() {
    if (!this.repo) {
      if (this.remote) {
        let tempRepoPath = (await mkTmpDir()).path;
        this.repo = await Repository.clone(this.remote.url, tempRepoPath);
        return;
      }

      this.repo = await Repository.open(this.repoPath!);
    }
  }

  _generateId() {
    // 20 bytes is good enough for git, so it's good enough for
    // me. In practice we probably have a lower collision
    // probability too, because we're allowed to retry if we know
    // the id is already in use (so we can really only collide
    // with things that have not yet merged into our branch).
    return crypto.randomBytes(20).toString('hex');
  }
}

async function withErrorHandling(id: string | undefined, type: string, fn: Function) {
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
      throw new CardstackError(`id ${id} is already in use for type ${type}`, {
        status: 409,
        source: { pointer: '/data/id' },
      });
    }
    if (err instanceof FileNotFound) {
      throw new CardstackError(`${type} with id ${id} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' },
      });
    }
    throw err;
  }
}

// async function finalizer(this: GitWriter, pendingChange: todo) {
//   let { id, type, change, file, signature } = pendingChange;
//   return withErrorHandling(id, type, async () => {
//     if (file) {
//       if (pendingChange.finalDocument) {
//         // use stringify library instead of JSON.stringify, since JSON's method
//         // is non-deterministic and could produce unnecessary diffs
//         file.setContent(
//           stringify({
//             attributes: pendingChange.finalDocument.attributes,
//             relationships: pendingChange.finalDocument.relationships,
//           })
//         );
//       } else {
//         file.delete();
//       }
//     }
//     let version = await change.finalize(signature, this.remote);
//     return { version, hash: file ? file.savedId() : null };
//   });
// }

// import { Writer } from '@cardstack/core/writer';
// import { Session } from '@cardstack/core/session';
// import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/document';
// import { inject } from '@cardstack/hub/dependency-injection';
// import { AddressableCard } from '@cardstack/core/card';
// import CardstackError from '@cardstack/core/error';

// let counter = 0;

// export default class EphemeralWriter implements Writer {
//   ephemeralStorage = inject('ephemeralStorage');

//   constructor(private realmCard: AddressableCard) {}

//   async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
//     let id = upstreamId ?? String(counter++);
//     let saved = this.ephemeralStorage.store(doc, id, this.realmCard.csId);
//     return { saved: saved!, id };
//   }

//   async update(_session: Session, id: UpstreamIdentity, doc: UpstreamDocument) {
//     let version = doc.jsonapi.data.meta?.version;
//     if (version == null) {
//       throw new CardstackError('missing required field "meta.version"', {
//         status: 400,
//         source: { pointer: '/data/meta/version' },
//       });
//     }

//     return this.ephemeralStorage.store(doc, id, this.realmCard.csId, String(version))!;
//   }

//   async delete(_session: Session, id: UpstreamIdentity, version: string | number) {
//     this.ephemeralStorage.store(null, id, this.realmCard.csId, version);
//   }
// }
