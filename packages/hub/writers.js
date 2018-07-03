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
    let schema = await this.schema.forBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareCreate(
      branch,
      session,
      type,
      schema.withOnlyRealFields(document),
      isSchema
    );
    try {
      let newSchema = await schema.validate(pending, { type, session });
      let context = await this._finalizeAndReply(pending, branch, session, type, schema);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      await this.pgSearchClient.saveDocument({ context });

      return context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async update(branch, session, type, id, document) {
    debugger;
    log.info("updating type=%s id=%s", type, id);
    let schema = await this.schema.forBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareUpdate(
      branch,
      session,
      type,
      id,
      schema.withOnlyRealFields(document),
      isSchema
    );
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      let context = await this._finalizeAndReply(pending, branch, session, type, schema);
      if (newSchema) {
        this.schema.invalidateCache();
      }

      await this.pgSearchClient.saveDocument({ context });

      return context.pristineDoc();
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async delete(branch, session, version, type, id) {
    log.info("deleting type=%s id=%s", type, id);
    let schema = await this.schema.forBranch(branch);
    let writer = this._lookupWriter(schema, type);
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

  async _finalizeAndReply(pending, branch, session, type, schema) {
    let meta = await pending.finalize();
    let contentType = schema.types.get(type);
    let finalDocument = pending.finalDocument;
    finalDocument.meta = meta;

    return new DocumentContext({
      type,
      branch,
      schema,
      id: finalDocument.id,
      upstreamDoc: finalDocument,
      sourceId: contentType.dataSource.id,
      read: async (type, id) => {
        let result;
        try {
          result = await this.searchers.get(Session.INTERNAL_PRIVILEGED, branch, type, id);
        } catch (err) {
          if (err.status !== 404) { throw err; }
        }

        if (result && result.data) {
          return result.data;
        }
      }
    });
  }

  _lookupWriter(schema, type) {
    let contentType = schema.types.get(type);
    let writer;
    if (!contentType || !contentType.dataSource || !(writer = contentType.dataSource.writer)) {
      log.debug('non-writeable type %s: exists=%s hasDataSource=%s hasWriter=%s', type, !!contentType, !!(contentType && contentType.dataSource), !!writer);

      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Not a writable type"
      });
    }
    return writer;
  }
});
