const Error = require('@cardstack/data-source/error');

class Writers {
  constructor(schemaCache) {
    this.schemaCache = schemaCache;
  }

  async create(branch, user, type, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareCreate(branch, user, type, document);
    await this._validate(schema, type, null, null, pending.afterDocument);
    return this._finalizeAndReply(pending);
  }

  async update(branch, user, type, id, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareUpdate(branch, user, type, id, document);
    await this._validate(schema, type, id, pending.beforeDocument, pending.afterDocument);
    return this._finalizeAndReply(pending);
  }

  async delete(branch, user, version, type, id) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareDelete(branch, user, version, type, id);
    await pending.finalize();
  }

  async _finalizeAndReply(pending) {
    let meta = await pending.finalize();
    let responseDocument = {
      id: pending.afterDocument.id,
      type: pending.afterDocument.type,
      meta
    };
    if (pending.afterDocument.attributes) {
      responseDocument.attributes = pending.afterDocument.attributes;
    }
    if (pending.afterDocument.relationships) {
      responseDocument.relationships = pending.afterDocument.relationships;
    }
    return responseDocument;
  }

  async _validate(schema, type, id, beforeDocument, afterDocument) {
    let errors = await schema.validationErrors(afterDocument, { type, id });
    if (errors.length > 1) {
      errors[0].additionalErrors = errors.slice(1);
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  _lookupWriter(schema, type) {
    let contentType = schema.types.get(type);
    let writer;
    if (!contentType || !contentType.dataSource || !(writer = contentType.dataSource.writer)) {
      throw new Error(`"${type}" is not a writable type`, {
        status: 403,
        title: "Not a writable type"
      });
    }
    return writer;
  }
}

module.exports = Writers;
