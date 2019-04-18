const crypto = require('crypto');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');
const { statSync } = require("fs");
const streamToPromise = require('stream-to-promise');
const { cardContextToId, cardContextFromId } = require('@cardstack/plugin-utils/card-context');

module.exports = declareInjections({
  indexers: 'hub:indexers',
  service: `plugin-services:${require.resolve('./service')}`,
  currentSchema: 'hub:current-schema'
}, class Writer {

  get storage() {
    if (!this._storage) {
      this._storage = this.service.findStorage(this.dataSource.id);
    }
    return this._storage;
  }

  // TODO seems awkward that an upstream data source writer needs to know about how card ID's work.
  // probbaly it would be better if an id generator function could be provided to the writer
  // or is there a way we can keep id's that have card context completely outside of these writers?
  async prepareCreate(session, type, cardInstanceId, document, isSchema) {
    let modelId, cardId;
    let { sourceId, packageName } = cardContextFromId(type);
    let id = document.id;
    if (id == null) {
      id = this._generateId();
    }
    if (cardInstanceId == null) {
      cardId = id;
    } else {
      cardId = cardContextFromId(cardInstanceId).cardId;
      modelId = id;
    }
    id = cardContextToId({ sourceId, packageName, cardId, modelId });

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

    return {
      finalDocument: storedDocument,
      finalizer,
      type,
      id,
      storage: this.storage,
      isSchema
    };
  }

  async prepareBinaryCreate(session, type, stream) {
    let id = stream.id || this._generateId();

    let storedDocument = {
      type: 'cardstack-files',
      id,
      attributes: {
        'created-at':   new Date().toISOString(),
        'size':         statSync(stream.path).size,
        'content-type': stream.mimeType,
        'file-name':    stream.filename || stream.path
      }
    };

    let binaryFinalizer = async (pendingChange) => {
      let { storage, type, id } = pendingChange;
      let blob = await streamToPromise(stream);

      return { version: storage.storeBinary(type, id, storedDocument, blob) };
    };

    return {
      finalDocument: storedDocument,
      finalizer: binaryFinalizer,
      type,
      id,
      storage: this.storage
    };
  }

  async prepareUpdate(session, type, id, document, isSchema) {
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
    return {
      originalDocument: before,
      finalDocument: after,
      finalizer,
      type,
      id,
      storage: this.storage,
      isSchema,
      ifMatch: document.meta.version
    };
  }

  async prepareDelete(session, version, type, id, isSchema) {
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
    return {
      originalDocument: before,
      finalizer,
      type,
      id,
      storage: this.storage,
      isSchema,
      ifMatch: version
    };
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
  let { storage, isSchema, ifMatch, type, id } = pendingChange;

  if (type === 'checkpoints') {
    return { version: storage.makeCheckpoint(id) };
  } else if (type === 'restores') {
    return { version: await storage.restoreCheckpoint(pendingChange.finalDocument.relationships.checkpoint.data.id) };
  } else {
    return { version: storage.store(type, id, pendingChange.finalDocument, isSchema, ifMatch) };
  }
}
