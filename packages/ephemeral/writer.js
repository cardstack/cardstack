const EphermalStorage = require('./storage');
const crypto = require('crypto');
const Error = require('@cardstack/plugin-utils/error');
const PendingChange = require('@cardstack/plugin-utils/pending-change');

const pendingChanges = new WeakMap();

module.exports = class Writer {
  constructor({ storageKey }) {
    this.storage = EphermalStorage.create(storageKey);
  }

  async prepareCreate(branch, user, type, document, isSchema) {
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

    let pending = new PendingChange(null, document, finalizer);
    pendingChanges.set(pending, { type, id, storage: this.storage, isSchema: isSchema });
    return pending;
  }

  async prepareUpdate(branch, user, type, id, document, isSchema) {
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

  async prepareDelete(branch, user, version, type, id, isSchema) {
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

async function finalizer(pendingChange) {
  let { storage, isSchema, ifMatch, type, id } = pendingChanges.get(pendingChange);
  return { version: storage.store(type, id, pendingChange.finalDocument, isSchema, ifMatch) };
}
