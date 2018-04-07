const Error = require('@cardstack/plugin-utils/error');
const log = require('@cardstack/logger')('cardstack/writers');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schema: 'hub:current-schema',
  schemaLoader: 'hub:schema-loader'
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
    let pending = await writer.prepareCreate(branch, session, type, document, isSchema);
    try {
      let newSchema = await schema.validate(pending, { type, session });
      let response = await this._finalizeAndReply(pending);
      if (newSchema) {
        this.schema.invalidateCache();
      }
      return response;
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async update(branch, session, type, id, document) {
    log.info("updating type=%s id=%s", type, id);
    let schema = await this.schema.forBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let isSchema = this.schemaTypes.includes(type);
    let pending = await writer.prepareUpdate(branch, session, type, id, document, isSchema);
    try {
      let newSchema = await schema.validate(pending, { type, id, session });
      let response = await this._finalizeAndReply(pending);
      if (newSchema) {
        this.schema.invalidateCache();
      }
      return response;
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
    } finally {
      if (pending) { await pending.abort();  }
    }
  }

  async _finalizeAndReply(pending) {
    let meta = await pending.finalize();
    let finalDocument = pending.finalDocument;
    let responseDocument = {
      id: finalDocument.id,
      type: finalDocument.type,
      meta
    };
    if (finalDocument.attributes) {
      responseDocument.attributes = finalDocument.attributes;
    }
    if (finalDocument.relationships) {
      responseDocument.relationships = finalDocument.relationships;
    }
    return responseDocument;
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
