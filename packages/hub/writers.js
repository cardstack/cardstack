const Error = require('@cardstack/plugin-utils/error');
const log = require('@cardstack/logger')('cardstack/writers');
const { get } = require('lodash');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  currentSchema: 'hub:current-schema',
  schemaLoader: 'hub:schema-loader',
  searchers: 'hub:searchers',
  pgSearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class Writers {
  get schemaTypes() {
    return this.schemaLoader.ownTypes();
  }

  async create(session, type, document) {
    log.info("creating type=%s", type);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }

    return await this.handleCreate(false, session, type, document);
  }

  async createBinary(session, type, stream) {
    log.info("creating type=%s from binary stream", type);
    if (!stream.read) {
      throw new Error('The passed stream must be a readable binary stream', {
        status: 400
      });
    }

    return await this.handleCreate(true, session, type, stream);

  }

  async handleCreate(isBinary, session, type, documentOrStream) {
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.currentSchema.getSchema();
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);

    let pending;

    if (isBinary) {
      let opts = await writer.prepareBinaryCreate(
        session,
        type,
        documentOrStream
      );
      let { originalDocument, finalDocument, finalizer, aborter } = opts;
      pending = await this.createPendingChange({ originalDocument, finalDocument, finalizer, aborter, opts});
    } else {
      let isSchema = this.schemaTypes.includes(type);
      let opts = await writer.prepareCreate(
        session,
        type,
        this._cleanupBodyData(schema, documentOrStream.data),
        isSchema
      );
      let { originalDocument, finalDocument, finalizer, aborter } = opts;
      pending = await this.createPendingChange({ originalDocument, finalDocument, finalizer, aborter, opts});
    }

    let context;
    try {
      let newSchema = await schema.validate(pending, { type, session });
      context = await this._finalize(pending, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.currentSchema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.currentSchema, this.searchers);
      await batch.saveDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return await context.applyReadAuthorization({ session });
  }

  async update(session, type, id, document) {
    log.info("updating type=%s id=%s", type, id);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.currentSchema.getSchema();
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let opts = await writer.prepareUpdate(
      session,
      type,
      id,
      this._cleanupBodyData(schema, document.data),
      isSchema
    );
    let { originalDocument, finalDocument, finalizer, aborter } = opts;
    let pending = await this.createPendingChange({ originalDocument, finalDocument, finalizer, aborter, opts });
    let context;
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      context = await this._finalize(pending, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.currentSchema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.currentSchema, this.searchers);
      await batch.saveDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return await context.applyReadAuthorization({ session });
  }

  async delete(session, version, type, id) {
    log.info("deleting type=%s id=%s", type, id);
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.currentSchema.getSchema();
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let opts = await writer.prepareDelete(session, version, type, id, isSchema);
    let { originalDocument, finalDocument, finalizer, aborter } = opts;
    let pending = await this.createPendingChange({ originalDocument, finalDocument, finalizer, aborter, opts });
    try {
      let newSchema = await schema.validate(pending, { session });
      let context = await this._finalize(pending, type, newSchema || schema, sourceId, id);

      if (newSchema) {
        this.currentSchema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.currentSchema, this.searchers);
      await batch.deleteDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async createPendingChange({ originalDocument, finalDocument, finalizer, aborter, opts }) {
    let schema = await this.currentSchema.getSchema();
    let type = originalDocument ? originalDocument.type : finalDocument.type;
    let contentType = schema.getType(type);
    let sourceId;
    if (contentType) {
      sourceId = get(contentType, 'dataSource.id');
    }

    return new PendingChange({
      originalDocument,
      finalDocument,
      finalizer,
      aborter,
      sourceId,
      schema,
      opts,
      searchers: this.searchers,
    });
  }

  async _finalize(pending, type, schema, sourceId, id) {
    let meta = await pending.finalize();
    let { finalDocumentContext } = pending;

    if (finalDocumentContext) {
      await finalDocumentContext.updateDocumentMeta(meta);
      return finalDocumentContext;
    }

    // This is the scenario where the document is being deleted
    return this.searchers.createDocumentContext({
      id,
      type,
      schema,
      sourceId,
      upstreamDoc: null
    });
  }

  _getSchemaDetailsForType(schema, type) {
    let contentType = schema.getType(type);
    if (!contentType || !contentType.dataSource || !contentType.dataSource.writer) {
      log.debug('non-writeable type %s: exists=%s hasDataSource=%s hasWriter=%s',
        type,
        Boolean(contentType),
        Boolean(contentType && contentType.dataSource),
        Boolean(contentType && contentType.dataSource && contentType.dataSource.writer));

      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Not a writable type"
      });
    }

    let writer = contentType.dataSource.writer;
    let sourceId = contentType.dataSource.id;
    return { writer, sourceId };
  }

  _cleanupBodyData(schema, data) {
    let doc = schema.withOnlyRealFields(data);  // remove computed fields
    return this._createQueryLinks(doc);         // convert `cardstack-queries` relationships to links.related
  }

  _createQueryLinks(doc) {
    if (!doc.relationships) {
      return doc;
    }

    let activeDoc = doc;

    for (let fieldName of Object.keys(doc.relationships)) {
      let relationshipData = doc.relationships[fieldName] && doc.relationships[fieldName].data;

      if ( relationshipData &&
        ((relationshipData.length && relationshipData[0].type === 'cardstack-queries') ||
        relationshipData.type === 'cardstack-queries')
      ) {
        if (activeDoc === doc) {
          activeDoc = Object.assign({}, doc);
        }
        if (activeDoc.relationships === doc.relationships) {
          activeDoc.relationships = Object.assign({}, doc.relationships);
        }
        activeDoc.relationships[fieldName].links = {
          related: Array.isArray(relationshipData) ? relationshipData[0].id : relationshipData.id
        };
        delete activeDoc.relationships[fieldName].data;
      }
    }

    return activeDoc;
  }
});

class PendingChange {
  constructor({
    originalDocument,
    finalDocument,
    finalizer,
    aborter,
    searchers,
    sourceId,
    schema,
    opts
  }) {
    if (!searchers || !schema) {
      throw new Error(`PendingChange requires 'searchers' and 'schema' arguments.`);
    }

    this.originalDocument = originalDocument;
    this.finalDocument = finalDocument;
    this.serverProvidedValues = new Map();
    this._finalizer = finalizer;
    this._aborter = aborter;

    if (schema && searchers) {
      if (originalDocument) {
        this.originalDocumentContext = searchers.createDocumentContext({
          type: originalDocument.type,
          schema,
          sourceId,
          id: originalDocument.id,
          upstreamDoc: originalDocument ? { data: originalDocument } : null
        });
      }
      if (finalDocument) {
        this.finalDocumentContext = searchers.createDocumentContext({
          type: finalDocument.type,
          schema,
          sourceId,
          id: finalDocument.id,
          upstreamDoc: finalDocument ? { data: finalDocument } : null
        });
      }
    }

    for (let prop of Object.keys(opts || {})) {
      if (this[prop] != null) { continue; }
      this[prop] = opts[prop];
    }
  }

  async finalize() {
    let finalizer = this._finalizer;
    this._finalizer = null;
    this._aborter = null;
    if (finalizer) {
      return finalizer.call(null, this);
    }
  }

  async abort() {
    let aborter = this._aborter;
    this._finalizer = null;
    this._aborter = null;
    if (aborter) {
      return aborter.call(null, this);
    }
  }
}