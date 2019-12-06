const crypto = require('crypto');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');
const { statSync } = require('fs');
const streamToPromise = require('stream-to-promise');
const { merge, cloneDeep } = require('lodash');
const { isInternalCard } = require('@cardstack/plugin-utils/card-utils');

function getType(model) {
  return model.data ? model.data.type : model.type;
}

function getId(model) {
  return model.data ? model.data.id : model.id;
}

function getMeta(model) {
  return model.data ? model.data.meta : model.meta;
}

module.exports = declareInjections(
  {
    indexers: 'hub:indexers',
    service: `plugin-services:${require.resolve('./service')}`,
  },
  class Writer {
    get hasCardSupport() {
      return true;
    }

    get storage() {
      if (!this._storage) {
        this._storage = this.service.findStorage(this.dataSource.id);
      }
      return this._storage;
    }

    async prepareCreate(session, type, document, isSchema) {
      let id = getId(document);
      if (id == null) {
        id = this._generateId();
      }

      if (this.storage.lookup(type, id)) {
        throw new Error(`id ${id} is already in use for type ${type}`, {
          status: 409,
          source: { pointer: '/data/id' },
        });
      }

      let storedDocument =
        document.data && isInternalCard(type, id)
          ? { data: { id, type: getType(document) } }
          : { id, type: getType(document) };

      if (document.data && isInternalCard(type, id)) {
        storedDocument = merge(storedDocument, cloneDeep(document));
      } else {
        if (document.attributes) {
          storedDocument.attributes = document.attributes;
        }
        if (document.relationships) {
          storedDocument.relationships = document.relationships;
        }
      }

      return {
        finalDocument: storedDocument,
        finalizer,
        type,
        id,
        storage: this.storage,
        isSchema,
      };
    }

    async prepareBinaryCreate(session, type, stream) {
      let id = stream.id || this._generateId();

      let storedDocument = {
        type: 'cardstack-files',
        id,
        attributes: {
          'created-at': new Date().toISOString(),
          size: statSync(stream.path).size,
          'content-type': stream.mimeType,
          'file-name': stream.filename || stream.path,
        },
      };

      let binaryFinalizer = async pendingChange => {
        let { storage, type, id } = pendingChange;
        let blob = await streamToPromise(stream);

        return { version: storage.storeBinary(type, id, storedDocument, blob) };
      };

      return {
        finalDocument: storedDocument,
        finalizer: binaryFinalizer,
        type,
        id,
        storage: this.storage,
      };
    }

    async prepareUpdate(session, type, id, document, isSchema) {
      let meta = getMeta(document);
      if (!meta || meta.version == null) {
        throw new Error('missing required field "meta.version"', {
          status: 400,
          source: { pointer: '/data/meta/version' },
        });
      }

      let before = this.storage.lookup(type, id);
      if (!before) {
        throw new Error(`${type} with id ${id} does not exist`, {
          status: 404,
          source: { pointer: '/data/id' },
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
        ifMatch: meta.version,
      };
    }

    async prepareDelete(session, version, type, id, isSchema) {
      if (!version) {
        throw new Error('version is required', {
          status: 400,
          source: { pointer: '/data/meta/version' },
        });
      }

      let before = this.storage.lookup(type, id);
      if (!before) {
        throw new Error(`${type} with id ${id} does not exist`, {
          status: 404,
          source: { pointer: '/data/id' },
        });
      }
      return {
        originalDocument: before,
        finalizer,
        type,
        id,
        storage: this.storage,
        isSchema,
        ifMatch: version,
      };
    }

    _generateId() {
      return crypto.randomBytes(20).toString('hex');
    }
  }
);

function patch(before, diffDocument) {
  let after;
  let afterResource;
  let beforeResource;
  let diffDocumentResource;

  if (diffDocument.data && isInternalCard(diffDocument.data.type, diffDocument.data.id)) {
    after = { data: Object.assign({}, before.data) };
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

async function finalizer(pendingChange) {
  let { storage, isSchema, ifMatch, type, id } = pendingChange;

  if (type === 'checkpoints') {
    return { version: storage.makeCheckpoint(id) };
  } else if (type === 'restores') {
    let checkpoint = pendingChange.finalDocument.data
      ? pendingChange.finalDocument.data.relationships.checkpoint
      : pendingChange.finalDocument.relationships.checkpoint;
    return { version: await storage.restoreCheckpoint(checkpoint.data.id) };
  } else {
    return { version: storage.store(type, id, pendingChange.finalDocument, isSchema, ifMatch) };
  }
}
