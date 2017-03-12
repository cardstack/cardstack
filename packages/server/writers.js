const Error = require('@cardstack/data-source/error');

class Writers {
  constructor(schemaCache) {
    this.schemaCache = schemaCache;
  }

  async create(branch, user, type, document) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    await this._validate(schema, document, type);
    let errors = await schema.validationErrors(type, document);
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
    await this._validate(schema, pending.document, type, id);
    let meta = await pending.finalize();
    let responseDocument = {
      id,
      type,
      meta
    };
    if (pending.document.attributes) {
      responseDocument.attributes = pending.document.attributes;
    }
    if (pending.document.relationships) {
      responseDocument.relationships = pending.document.relationships;
    }
    return responseDocument;
  }

  async delete(branch, user, version, type, id) {
    let schema = await this.schemaCache.schemaForBranch(branch);
    let writer = this._lookupWriter(schema, type);
    let pending = await writer.prepareDelete(branch, user, version, type, id);
    await pending.finalize();
  }

  async _validate(schema, document, type, id) {
    let errors = await schema.validationErrors(type, document, id);
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
