const Error = require('@cardstack/data-source/error');
const Field = require('@cardstack/server/field');
const Constraint = require('@cardstack/server/constraint');
const ContentType = require('@cardstack/server/content-type');
const DataSource = require('@cardstack/server/data-source');
const Plugins = require('@cardstack/server/plugins');
const bootstrapSchema = require('./bootstrap-schema');

module.exports = class Schema {

  static async bootstrap() {
    // Our schema itself has a schema. This meta-schema isn't editable.
    return this.loadFrom(bootstrapSchema);
  }

  static ownTypes() {
    return ['content-types', 'fields', 'constraints', 'data-sources'];
  }

  static async loadFrom(models) {
    let plugins = await Plugins.load();
    let constraints = new Map();
    for (let model of models) {
      if (!this.ownTypes().includes(model.type)) {
        throw new Error(`attempted to load schema including non-schema type "${model.type}"`);
      }
      if (model.type === 'constraints') {
        constraints.set(model.id, new Constraint(model, plugins));
      }
    }

    let fields = new Map();
    for (let model of models) {
      if (model.type === 'fields') {
        fields.set(model.id, new Field(model, plugins, constraints));
      }
    }

    let dataSources = new Map();
    for (let model of models) {
      if (model.type === 'data-sources') {
        dataSources.set(model.id, new DataSource(model, plugins));
      }
    }

    let types = new Map();
    for (let model of models) {
      if (model.type === 'content-types') {
        types.set(model.id, new ContentType(model, fields, dataSources));
      }
    }

    return new this(types, fields);
  }

  constructor(types, fields) {
    this.types = types;
    this.fields = fields;
    this._mapping = null;
  }

  // id is optional. If you provide it, we ensure the document matches
  // the expected id. Type and document are both mandatory.
  async validationErrors(type, document, id) {
    let errors = [];

    if (!document.type) {
      errors.push(new Error(`missing required field "type"`, {
        status: 400,
        source: { pointer: '/data/type' }
      }));
      return errors;
    }

    if (document.type !== type) {
      errors.push(new Error(`the type "${document.type}" is not allowed here`, {
        status: 409,
        source: { pointer: '/data/type' }
      }));
      return errors;
    }

    if (id != null && !document.id) {
      throw new Error('missing required field "id"', {
        status: 400,
        source: { pointer: '/data/id' }
      });
    }

    if (id != null && String(document.id) !== id) {
      throw new Error('not allowed to change "id"', {
        status: 403,
        source: { pointer: '/data/id' }
      });
    }

    let contentType = this.types.get(type);
    if (!contentType) {
      errors.push(new Error(`"${type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      }));
      return errors;
    }

    errors = errors.concat(await contentType.validationErrors(document));

    return errors;
  }

  mapping() {
    if (!this._mapping) {
      this._mapping = {};
      for (let contentType of this.types.values()) {
        this._mapping[contentType.id] = contentType.mapping();
      }
    }
    return this._mapping;
  }

};
