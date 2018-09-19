const Error = require('@cardstack/plugin-utils/error');
const log = require('@cardstack/logger')('cardstack/writers');
const DocumentContext = require('./indexing/document-context');
const { declareInjections } = require('@cardstack/di');
const Session = require('@cardstack/plugin-utils/session');

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
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareCreate(
      branch,
      session,
      type,
      schema.withOnlyRealFields(document.data),
      isSchema
    );
    let pristine;
    try {
      let newSchema = await schema.validate(pending, { type, session });
      let context = await this._finalize(pending, branch, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch();
      await batch.saveDocument(context);
      await batch.done();

      pristine = await context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return schema.applyReadAuthorization(pristine, { session });
  }

  async createBinary(branch, session, type, stream) {
    log.info("creating type=%s from binary stream", type);
    if (!stream.read) {
      throw new Error('The passed stream must be a readable binary stream', {
        status: 400
      });
    }
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let pending = await writer.prepareBinaryCreate(
      branch,
      session,
      type,
      stream
    );
    let pristine;
    try {
      let newSchema = await schema.validate(pending, { type, session });
      let context = await this._finalize(pending, branch, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch();
      await batch.saveDocument(context);
      await batch.done();

      pristine = await context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return schema.applyReadAuthorization(pristine, { session });
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
    let pristine;
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      let context = await this._finalize(pending, branch, type, newSchema || schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let batch = this.pgSearchClient.beginBatch();
      await batch.saveDocument(context);
      await batch.done();

      pristine = await context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return schema.applyReadAuthorization(pristine, { session });
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

      let batch = this.pgSearchClient.beginBatch();
      await batch.deleteDocument(context);
      await batch.done();
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async _finalize(pending, branch, type, schema, sourceId, id) {
    let meta = await pending.finalize();
    let finalDocument = pending.finalDocument;
    if (finalDocument) {
      finalDocument.meta = meta;
    }

    return new DocumentContext({
      type,
      branch,
      schema,
      sourceId,
      id: id || finalDocument.id,
      upstreamDoc: finalDocument ? { data: finalDocument } : null,
      read: this._read(branch)
    });
  }

  _read(branch) {
    return async (type, id) => {
      let resource;
      try {
        resource = (await this.searchers._getResourceAndMeta(Session.INTERNAL_PRIVILEGED, branch, type, id)).resource;
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (resource) {
        return resource;
      }
    };
  }

  _getSchemaDetailsForType(schema, type) {
    let contentType = schema.types.get(type);
    let writer;
    if (!contentType || !contentType.dataSource || !(writer = contentType.dataSource.writer)) {
      log.debug('non-writeable type %s: exists=%s hasDataSource=%s hasWriter=%s', type, !!contentType, !!(contentType && contentType.dataSource), !!writer);

      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Not a writable type"
      });
    }

    let sourceId = contentType.dataSource.id;
    return { writer, sourceId };
  }
});
