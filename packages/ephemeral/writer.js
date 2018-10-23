const crypto = require('crypto');
const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');
const { declareInjections } = require('@cardstack/di');
const { statSync } = require("fs");
const streamToPromise = require('stream-to-promise');

const pendingChanges = new WeakMap();

module.exports = declareInjections({
  indexers: 'hub:indexers',
  service: `plugin-services:${require.resolve('./service')}`
}, class Writer {

  get storage() {
    if (!this._storage) {
      this._storage = this.service.findStorage(this.dataSource.id);
    }
    return this._storage;
  }

  async prepareCreate(branch, session, type, document, isSchema) {
    if (branch !== 'master') {
      throw new Error("ephemeral storage only supports branch master");
    }

    let id = document.id;
    if (id == null) {
      id = this._generateId();
    }


    if (this.storage.lookup(type, id)) {
      throw new Error(`id ${id} is already in use`, { status: 409, source: { pointer: '/data/id'}});
    }


    let storedDocument = { id, type: document.type };
    if (document.attributes) {
      storedDocument.attributes = document.attributes;
    }
    if (document.relationships) {
      storedDocument.relationships = document.relationships;
    }

    let pending = new PendingChange(null, storedDocument, finalizer);
    pendingChanges.set(pending, { type, id, storage: this.storage, isSchema: isSchema });
    return pending;
  }

  async prepareBinaryCreate(branch, session, type, stream) {
    if (branch !== 'master') {
      throw new Error("ephemeral storage only supports branch master");
    }

    let id = this._generateId();

    let storedDocument = {
      type: 'cs-files',
      id,
      attributes: {
        'created-at':   new Date().toISOString(),
        'size':         statSync(stream.path).size,
        'content-type': stream.mimeType,
        'file-name':    stream.filename
      }
    };

    let binaryFinalizer = async (pendingChange) => {
      let { storage, type, id } = pendingChanges.get(pendingChange);
      let blob = await streamToPromise(stream);

      return { version: storage.storeBinary(type, id, blob) };
    };

    let pending = new PendingChange(null, storedDocument, binaryFinalizer);
    pendingChanges.set(pending, { type, id, storage: this.storage });
    return pending;
  }

  async prepareUpdate(branch, session, type, id, document, isSchema) {
    if (!document.meta || !document.meta.version) {
      throw new Error('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' }
      });
    }

    let before = this.storage.lookup(type, id);
    if (!before) {
      throw new Error(`${type} with id ${id} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' }
      });
    }
    let after = patch(before, document);
    let pending = new PendingChange(before, after, finalizer);
    pendingChanges.set(pending, { type, id, storage: this.storage, isSchema, ifMatch: document.meta.version });
    return pending;
  }

  async prepareDelete(branch, session, version, type, id, isSchema) {
    if (!version) {
      throw new Error('version is required', {
        status: 400,
        source: { pointer: '/data/meta/version' }
      });
    }

    let before = this.storage.lookup(type, id);
    if (!before) {
      throw new Error(`${type} with id ${id} does not exist`, {
        status: 404,
        source: { pointer: '/data/id' }
      });
    }
    let pending = new PendingChange(before, null, finalizer);
    pendingChanges.set(pending, { type, id, storage: this.storage, isSchema, ifMatch: version });
    return pending;
  }

  _generateId() {
    return crypto.randomBytes(20).toString('hex');
  }

});

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

async function finalizer(pendingChange) {
  let { storage, isSchema, ifMatch, type, id } = pendingChanges.get(pendingChange);

  if (type === 'checkpoints') {
    return { version: storage.makeCheckpoint(id) };
  } else if (type === 'restores') {
    return { version: await storage.restoreCheckpoint(pendingChange.finalDocument.relationships.checkpoint.data.id) };
  } else {
    return { version: storage.store(type, id, pendingChange.finalDocument, isSchema, ifMatch) };
  }
}
