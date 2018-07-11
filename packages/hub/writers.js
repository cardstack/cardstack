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
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareCreate(
      branch,
      session,
      type,
      schema.withOnlyRealFields(document),
      isSchema
    );
    let pristine;
    try {
      let newSchema = await schema.validate(pending, { type, session });
      let context = await this._finalize(pending, branch, type, schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let touchCounter = 0;
      let touched = { [`${context.type}/${context.id}`]: touchCounter };
      await this.pgSearchClient.saveDocument({ context, touched, touchCounter });
      await this._invalidations(context, touched, ++touchCounter);

      pristine = await context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }

    return schema.applyReadAuthorization(pristine, { session });
  }

  async update(branch, session, type, id, document) {
    log.info("updating type=%s id=%s", type, id);
    await this.pgSearchClient.ensureDatabaseSetup();

    let schema = await this.schema.forBranch(branch);
    let { writer, sourceId } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareUpdate(
      branch,
      session,
      type,
      id,
      schema.withOnlyRealFields(document),
      isSchema
    );
    let pristine;
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      let context = await this._finalize(pending, branch, type, schema, sourceId);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      let touchCounter = 0;
      let touched = { [`${context.type}/${context.id}`]: touchCounter };
      await this.pgSearchClient.saveDocument({ context, touched, touchCounter });
      await this._invalidations(context, touched, ++touchCounter);

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
    let { writer } = this._getSchemaDetailsForType(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareDelete(branch, session, version, type, id, isSchema);
    try {
      let newSchema = await schema.validate(pending, { session });
      await pending.finalize();

      if (newSchema) {
        this.schema.invalidateCache();
      }

      await this.pgSearchClient.deleteDocument({ branch, type, id });
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async _finalize(pending, branch, type, schema, sourceId) {
    let meta = await pending.finalize();
    let finalDocument = pending.finalDocument;
    finalDocument.meta = meta;

    return new DocumentContext({
      type,
      branch,
      schema,
      sourceId,
      id: finalDocument.id,
      upstreamDoc: finalDocument,
      read: this._read(branch)
    });
  }

  async _invalidations(context, touched, touchCounter) {
    await this.pgSearchClient.invalidations({
      touched,
      touchCounter,
      schema: context.schema,
      branch: context.branch,
      read: this._read(context.branch)
    });
  }

  _read(branch) {
    return async (type, id) => {
      let result;
      try {
        result = await this.searchers.get(Session.INTERNAL_PRIVILEGED, branch, type, id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (result && result.data) {
        return result.data;
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
