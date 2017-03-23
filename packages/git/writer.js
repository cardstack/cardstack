const {
  Repository
} = require('nodegit');

const logger = require('heimdalljs-logger');
const crypto = require('crypto');
const Change = require('./change');
const os = require('os');
const process = require('process');
const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

const pendingChanges = new WeakMap();

module.exports = class Writer {
  constructor({ repo, idGenerator, basePath, branchPrefix }) {
    this.repoPath = repo;
    this.basePath = basePath;
    this.branchPrefix = branchPrefix || "";
    this.repo = null;
    this.log = logger('writer');
    let hostname = os.hostname();
    this.myName = `PID${process.pid} on ${hostname}`;
    this.myEmail = `${os.userInfo().username}@${hostname}`;
    this.idGenerator = idGenerator;
  }

  async prepareCreate(branch, user, type, document, isSchema) {
    return withErrorHandling(document.id, type, async () => {
      await this._ensureRepo();

      let change = await Change.create(this.repo, null, this.branchPrefix + branch);
      let id = document.id;
      let file;
      while (id == null) {
        let candidateId = this._generateId();
        let candidateFile = await change.get(this._filenameFor(document.type, candidateId, isSchema), { allowCreate: true });
        if (!candidateFile.exists()) {
          id = candidateId;
          file = candidateFile;
        }
      }

      if (!file) {
        file = await change.get(this._filenameFor(document.type, id, isSchema), { allowCreate: true });
      }

      let gitDocument = { id, type: document.type };
      if (document.attributes) {
        gitDocument.attributes = document.attributes;
      }
      if (document.relationships) {
        gitDocument.relationships = document.relationships;
      }

      let pending = new PendingChange(null, gitDocument, finalizer);
      let signature = this._commitOptions('create', document.type, id, user);
      pendingChanges.set(pending, { type: document.type, id, signature, change, file });
      return pending;
    });
  }

  async prepareUpdate(branch, user, type, id, document, isSchema) {
    if (!document.meta || !document.meta.version) {
      throw new Error('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' }
      });
    }

    await this._ensureRepo();
    return withErrorHandling(id, type, async () => {
      let change = await Change.create(this.repo, document.meta.version, this.branchPrefix + branch);
      let file = await change.get(this._filenameFor(type, id, isSchema), { allowUpdate: true });
      let before = JSON.parse(await file.getBuffer());
      let after = patch(before, document);
      // we don't write id & type into the actual file (they're part
      // of the filename). But we want them present on the
      // PendingChange as complete valid documents.
      before.id = id;
      before.type = type;
      after.id = document.id;
      after.type = document.type;
      let signature = this._commitOptions('update', type, id, user);
      let pending = new PendingChange(before, after, finalizer);
      pendingChanges.set(pending, { type, id, signature, change, file });
      return pending;
    });
  }

  async prepareDelete(branch, user, version, type, id, isSchema) {
    if (!version) {
      throw new Error('version is required', {
        status: 400,
        source: { pointer: '/data/meta/version' }
      });
    }
    await this._ensureRepo();
    return withErrorHandling(id, type, async () => {
      let change = await Change.create(this.repo, version, this.branchPrefix + branch);
      let file = await change.get(this._filenameFor(type, id, isSchema));
      let before = JSON.parse(await file.getBuffer());
      file.delete();
      before.id = id;
      before.type = type;
      let pending = new PendingChange(before, null, finalizer);
      let signature = this._commitOptions('delete', type, id, user);
      pendingChanges.set(pending, { type, id, signature, change });
      return pending;
    });
  }

  _commitOptions(operation, type, id, user) {
    return {
      authorName: user.fullName,
      authorEmail: user.email,
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `${operation} ${type} ${id.slice(12)}`
    };
  }

  _filenameFor(type, id, isSchema) {
    let category = isSchema ? 'schema' : 'contents';
    let base = this.basePath ? this.basePath + '/' : '';
    return `${base}${category}/${type}/${id}.json`;
  }

  async _ensureRepo() {
    if (!this.repo) {
      this.repo = await Repository.open(this.repoPath);
    }
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

};

function patch(before, diffDocument) {
  let after = Object.assign({}, before);
  for (let section of ['attributes', 'relationships']) {
    if (diffDocument[section]) {
      after[section] = Object.assign(
        {},
        before[section],
        diffDocument[section]
      );
    }
  }
  return after;
}

async function withErrorHandling(id, type, fn) {
  try {
    return await fn();
  } catch (err) {
    if (/Unable to parse OID/.test(err.message) || /Object not found/.test(err.message)) {
      throw new Error(err.message, { status: 400, source: { pointer: '/data/meta/version' }});
    }
    if (err instanceof Change.GitConflict) {
      throw new Error("Merge conflict", { status: 409 });
    }
    if (err instanceof Change.OverwriteRejected) {
      throw new Error(`id ${id} is already in use`, { status: 409, source: { pointer: '/data/id'}});
    }
    if (err instanceof Change.NotFound) {
      throw new Error(`${type} with id ${id} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' }
      });
    }
    throw err;
  }
}


async function finalizer(pendingChange) {
  let { id, type, change, file, signature } = pendingChanges.get(pendingChange);
  return withErrorHandling(id, type, async () => {
    if (file) {
      if (pendingChange.finalDocument) {
        file.setContent(JSON.stringify({
          attributes: pendingChange.finalDocument.attributes,
          relationships: pendingChange.finalDocument.relationships
        }, null, 2));
      } else {
        file.delete();
      }
    }
    let version = await change.finalize(signature);
    return { version };
  });
}
