const Error = require('@cardstack/data-source/error');

class Writers {
  constructor(schemaCache) {
    this.schemaCache = schemaCache;
  }

  async create(branch, user, type, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareCreate(branch, user, type, document);
    await this._validate(schema, pending, { type });
    return this._finalizeAndReply(pending);
  }

  async update(branch, user, type, id, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareUpdate(branch, user, type, id, document);
    await this._validate(schema, pending, { type, id });
    return this._finalizeAndReply(pending);
  }

  async delete(branch, user, version, type, id) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareDelete(branch, user, version, type, id);
    await this._validate(schema, pending, {});
    await pending.finalize();
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

  async _validate(schema, pending, constraints) {
    let errors = await schema.validationErrors(pending, constraints);
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
