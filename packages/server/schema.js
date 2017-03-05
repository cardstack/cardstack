const Error = require('@cardstack/data-source/error');
const Field = require('@cardstack/server/field');
const Constraint = require('@cardstack/server/constraint');
const ContentType = require('@cardstack/server/content-type');

module.exports = class Schema {

  static ownTypes() {
    return ['content-types', 'fields', 'constraints'];
  }

  static async loadFrom(models, plugins) {
    let constraints = new Map();
    for (let model of models) {
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

    let types = new Map();
    for (let model of models) {
      if (model.type === 'content-types') {
        types.set(model.id, new ContentType(model, fields));
      }
    }

    return new this(types);
  }

  constructor(types) {
    this.types = types;
    this._mapping = null;
  }

  async validationErrors(document) {
    let errors = [];

    let type = this.types.get(document.type);
    if (!type) {
      errors.push(new Error(`"${document.type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      }));
      return errors;
    }

    errors = errors.concat(await type.validationErrors(document));

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
