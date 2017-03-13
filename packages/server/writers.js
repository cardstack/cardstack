const Error = require('@cardstack/data-source/error');

class Writers {
  constructor(schemaCache) {
    this.schemaCache = schemaCache;
  }

  async create(branch, user, type, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    await this._validate(schema, type, null, null, document);
    let errors = await schema.validationErrors(document, { type });
    if (errors.length > 1) {
      errors[0].additionalErrors = errors.slice(1);
    }
    if (errors.length > 0) {
      throw errors[0];
    }
    return writer.create(branch, user, type, document);
  }

  async update(branch, user, type, id, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareUpdate(branch, user, type, id, document);
    await this._validate(schema, type, id, pending.beforeDocument, pending.afterDocument);
    let meta = await pending.finalize();
    let responseDocument = {
      id,
      type,
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

  async delete(branch, user, version, type, id) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareDelete(branch, user, version, type, id);
    await pending.finalize();
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
