const Error = require('@cardstack/plugin-utils/error');
const log = require('@cardstack/logger')('cardstack/writers');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schema: 'hub:current-schema',
  schemaLoader: 'hub:schema-loader',
  searchers: 'hub:searchers',
  pgSearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`
},

class Writers {
  get schemaTypes() {
    return this.schemaLoader.ownTypes();
  }

  async create(branch, session, type, document) {
    log.info("creating type=%s", type);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }

    return await this.handleCreate(false, branch, session, type, document);
  }

  async createBinary(branch, session, type, stream) {
    log.info("creating type=%s from binary stream", type);
    if (!stream.read) {
      throw new Error('The passed stream must be a readable binary stream', {
        status: 400
      });
    }

    return await this.handleCreate(true, branch, session, type, stream);

  }

  async handleCreate(isBinary, branch, session, type, documentOrStream) {
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);

    let pending;

    if (isBinary) {
      pending = await writer.prepareBinaryCreate(
        branch,
        session,
        type,
        documentOrStream
      );
    } else {
      let isSchema = this.schemaTypes.includes(type);
      pending = await writer.prepareCreate(
        branch,
        session,
        type,
        schema.withOnlyRealFields(documentOrStream.data),
        isSchema
      );
    }

    let context;
    try {
      let newSchema = await schema.validate(pending, { type, session });
      context = await this._finalize(pending, branch, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.schema, this.searchers);
      await batch.saveDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return await context.applyReadAuthorization({ session });
  }

  async update(branch, session, type, id, document) {
    log.info("updating type=%s id=%s", type, id);
    if (!document.data) {
      throw new Error('The document must have a top-level "data" property', {
        status: 400
      });
    }
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareUpdate(
      branch,
      session,
      type,
      id,
      schema.withOnlyRealFields(document.data),
      isSchema
    );
    let context;
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      context = await this._finalize(pending, branch, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.schema, this.searchers);
      await batch.saveDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return await context.applyReadAuthorization({ session });
  }

  async delete(branch, session, version, type, id) {
    log.info("deleting type=%s id=%s", type, id);
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareDelete(branch, session, version, type, id, isSchema);
    try {
      let newSchema = await schema.validate(pending, { session });
      let context = await this._finalize(pending, branch, type, newSchema || schema, sourceId, id);

      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch(this.schema, this.searchers);
      await batch.deleteDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async _finalize(pending, branch, type, schema, sourceId, id) {
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
      branch,
      schema,
      sourceId,
      upstreamDoc: null
    });
  }

  _getSchemaDetailsForType(schema, type) {
    let contentType = schema.types.get(type);
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
});
