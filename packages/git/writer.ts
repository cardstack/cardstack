import { Repository, RemoteConfig, GitConflict, UnknownObjectId } from './git';
import { FileNotFound, OverwriteRejected } from './git/tree';

import { todo } from '@cardstack/plugin-utils/todo-any';

import crypto from 'crypto';
import Change from './change';
import os from 'os';
import process from 'process';
import Error from '@cardstack/plugin-utils/error';
import { promisify } from 'util';
import temp, { mkdir as mkdircb } from 'temp';

temp.track();

import { merge, cloneDeep } from 'lodash';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const Githereum = require('githereum/githereum');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const GithereumContract = require('githereum/build/contracts/Githereum.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const TruffleContract = require('truffle-contract');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { isInternalCard } = require('@cardstack/plugin-utils/card-utils');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const stringify = require('json-stable-stringify-without-jsonify');

import logger from '@cardstack/logger';
const log = logger('cardstack/git');

const mkdir = promisify(mkdircb);
const defaultBranch = 'master';

function getType(model: todo) {
  return model.data ? model.data.type : model.type;
}

function getId(model: todo) {
  return model.data ? model.data.id : model.id;
}

function getMeta(model: todo) {
  return model.data ? model.data.meta : model.meta;
}

interface WriterConfig {
  repo: string;
  basePath?: string;
  branchPrefix?: string;
  remote?: RemoteConfig;
  idGenerator: Function;
  githereum?: todo;
}

export default class Writer {
  static create(params: WriterConfig) {
    return new this(params);
  }

  myEmail: string;
  myName: string;
  remote?: RemoteConfig;
  idGenerator: Function;
  repoPath: string;
  basePath?: string;
  repo?: Repository;
  branchPrefix: string;
  githereumConfig: todo;
  githereum: todo;
  _githereumPromise?: Promise<todo>;

  constructor({ repo, idGenerator, basePath, branchPrefix, remote, githereum }: WriterConfig) {
    this.repoPath = repo;
    this.basePath = basePath;
    this.branchPrefix = branchPrefix || '';
    let hostname = os.hostname();
    this.myName = `PID${process.pid} on ${hostname}`;
    this.myEmail = `${os.userInfo().username}@${hostname}`;
    this.idGenerator = idGenerator;
    this.remote = remote;

    if (githereum) {
      let config = Object.assign({}, githereum);
      config.log = log.info.bind(log);
      this.githereumConfig = config;
    }
  }

  get hasCardSupport() {
    return true;
  }

  async prepareCreate(session: todo, type: string, document: todo, isSchema: boolean) {
    let id = getId(document);
    return withErrorHandling(id, type, async () => {
      await this._ensureRepo();
      let type = getType(document);
      let change = await Change.create(this.repo!, null, this.branchPrefix + defaultBranch, !!this.remote);

      let file;
      while (id == null) {
        let candidateId = this._generateId();
        let candidateFile = await change.get(this._filenameFor(type, candidateId, isSchema), { allowCreate: true });
        if (!candidateFile.exists()) {
          id = candidateId;
          file = candidateFile;
        }
      }

      if (!file) {
        file = await change.get(this._filenameFor(type, id, isSchema), { allowCreate: true });
      }

      let gitDocument: todo = document.data && isInternalCard(type, id) ? { data: { id, type } } : { id, type };

      if (document.data && isInternalCard(type, id)) {
        gitDocument = merge(gitDocument, cloneDeep(document));
      } else {
        if (document.attributes) {
          gitDocument.attributes = document.attributes;
        }
        if (document.relationships) {
          gitDocument.relationships = document.relationships;
        }
      }

      let signature = await this._commitOptions('create', type, id, session);
      return {
        finalDocument: gitDocument,
        finalizer: finalizer.bind(this),
        type,
        id,
        signature,
        change,
        file,
      };
    });
  }

  async prepareUpdate(session: todo, type: string, id: string, document: todo, isSchema: boolean) {
    let meta = getMeta(document);
    if (!meta || !meta.version) {
      throw new Error('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    await this._ensureRepo();
    return withErrorHandling(id, type, async () => {
      let change = await Change.create(this.repo!, meta.version, this.branchPrefix + defaultBranch, !!this.remote);

      let file = await change.get(this._filenameFor(type, id, isSchema), { allowUpdate: true });
      let before = JSON.parse((await file.getBuffer())!.toString());
      let after = patch(before, document);
      // we don't write id & type into the actual file (they're part
      // of the filename). But we want them present on the
      // PendingChange as complete valid documents.
      if (!isInternalCard(type, id)) {
        before.id = id;
        before.type = type;
        after.id = document.id;
        after.type = document.type;
      }
      let signature = await this._commitOptions('update', type, id, session);
      return {
        originalDocument: before,
        finalDocument: after,
        finalizer: finalizer.bind(this),
        type,
        id,
        signature,
        change,
        file,
      };
    });
  }

  async prepareDelete(session: todo, version: string, type: string, id: string, isSchema: boolean) {
    if (!version) {
      throw new Error('version is required', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }
    await this._ensureRepo();
    return withErrorHandling(id, type, async () => {
      let change = await Change.create(this.repo!, version, this.branchPrefix + defaultBranch, !!this.remote);

      let file = await change.get(this._filenameFor(type, id, isSchema));
      let before = JSON.parse((await file.getBuffer())!.toString());
      file.delete();
      before.id = id;
      before.type = type;
      let signature = await this._commitOptions('delete', type, id, session);
      return {
        originalDocument: before,
        finalizer: finalizer.bind(this),
        type,
        id,
        signature,
        change,
      };
    });
  }

  async _commitOptions(operation: string, type: string, id: string, session: todo) {
    let user = session && (await session.loadUser());
    let userAttributes = (user && user.data && user.data.attributes) || {};

    return {
      authorName: userAttributes['full-name'] || userAttributes.name || 'Anonymous Coward',
      authorEmail: userAttributes.email || 'anon@example.com',
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `${operation} ${type} ${String(id).slice(12)}`,
    };
  }

  _filenameFor(type: string, id: string, isSchema: boolean) {
    let base = this.basePath ? this.basePath + '/' : '';
    if (!isSchema && isInternalCard(type, id)) {
      return `${base}cards/${id}.json`;
    }
    let category = isSchema ? 'schema' : 'contents';
    return `${base}${category}/${type}/${id}.json`;
  }

  async _ensureRepo() {
    if (!this.repo) {
      if (this.remote) {
        // @ts-ignore promisify not typed well apparently?
        let tempRepoPath = await mkdir('cardstack-temp-repo');
        this.repo = await Repository.clone(this.remote.url, tempRepoPath);
        return;
      }

      this.repo = await Repository.open(this.repoPath);
    }
  }

  async _ensureGithereum() {
    await this._ensureRepo();

    if (!this.githereum && this.githereumConfig) {
      let contract = await this._getGithereumContract();

      this.githereum = new Githereum(
        this.repo!.path,
        this.githereumConfig.repoName,
        contract,
        this.githereumConfig.from,
        { log: log.info.bind(log) }
      );
    }
  }

  async _getGithereumContract() {
    let providerUrl = this.githereumConfig.providerUrl || 'http://localhost:9545';

    let GithereumTruffleContract = TruffleContract(GithereumContract);
    GithereumTruffleContract.setProvider(providerUrl);
    return await GithereumTruffleContract.at(this.githereumConfig.contractAddress);
  }

  _generateId() {
    if (this.idGenerator) {
      return this.idGenerator();
    } else {
      // 20 bytes is good enough for git, so it's good enough for
      // me. In practice we probably have a lower collision
      // probability too, because we're allowed to retry if we know
      // the id is already in use (so we can really only collide
      // with things that have not yet merged into our branch).
      return crypto.randomBytes(20).toString('hex');
    }
  }

  async _pushToGithereum() {
    await this._ensureGithereum();

    if (this.githereum) {
      log.info('Githereum is enabled, triggering push');
      // make sure only one push is ongoing at a time, by creating a chain of
      // promises here
      this._githereumPromise = Promise.resolve(this._githereumPromise).then(() => {
        log.info('Starting githereum push');
        return this.githereum
          .push(this.githereumConfig.tag)
          .then(() => log.info('Githereum push complete'))
          .catch((e: todo) => {
            log.error('Error pushing to githereum:', e, e.stack);
          });
      });
    } else {
      log.info('Githereum is disabled');
    }
  }
}

// TODO: we only need to do this here because the Hub has no generic
// "read" hook to call on writers. We should use that instead and move
// this into the generic hub:writers code.
function patch(before: todo, diffDocument: todo) {
  let after;
  let afterResource;
  let beforeResource;
  let diffDocumentResource;

  if (diffDocument.data && isInternalCard(diffDocument.data.type, diffDocument.data.id)) {
    after = { data: Object.assign({}, before.data), included: [] };
    if (Array.isArray(diffDocument.included)) {
      after.included = [].concat(diffDocument.included);
    }
    afterResource = after.data;
    beforeResource = before.data;
    diffDocumentResource = diffDocument.data;
  } else {
    after = Object.assign({}, before);
    afterResource = after;
    beforeResource = before;
    diffDocumentResource = diffDocument;
  }

  for (let section of ['attributes', 'relationships']) {
    if (diffDocumentResource[section]) {
      afterResource[section] = Object.assign({}, beforeResource[section], diffDocumentResource[section]);
    }
  }
  return after;
}

async function withErrorHandling(id: string, type: string, fn: Function) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnknownObjectId) {
      throw new Error(err.message, { status: 400, source: { pointer: '/data/meta/version' } });
    }
    if (err instanceof GitConflict) {
      throw new Error('Merge conflict', { status: 409 });
    }
    if (err instanceof OverwriteRejected) {
      throw new Error(`id ${id} is already in use for type ${type}`, { status: 409, source: { pointer: '/data/id' } });
    }
    if (err instanceof FileNotFound) {
      throw new Error(`${type} with id ${id} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' },
      });
    }
    throw err;
  }
}

async function finalizer(this: Writer, pendingChange: todo) {
  let { id, type, change, file, signature } = pendingChange;
  return withErrorHandling(id, type, async () => {
    if (file) {
      if (pendingChange.finalDocument) {
        // use stringify library instead of JSON.stringify, since JSON's method
        // is non-deterministic and could produce unnecessary diffs
        if (pendingChange.finalDocument.data && isInternalCard(type, id)) {
          file.setContent(stringify(pendingChange.finalDocument, null, 2));
        } else {
          file.setContent(
            stringify(
              {
                attributes: pendingChange.finalDocument.attributes,
                relationships: pendingChange.finalDocument.relationships,
              },
              null,
              2
            )
          );
        }
      } else {
        file.delete();
      }
    }
    let version = await change.finalize(signature, this.remote);
    await this._pushToGithereum();
    return { version, hash: file ? file.savedId() : null };
  });
}

module.exports = Writer;
