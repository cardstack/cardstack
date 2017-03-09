const Error = require('@cardstack/data-source/error');

module.exports = class Field {
  constructor(model, plugins, constraints) {
    this.id = model.id;
    this.fieldType = model.attributes['field-type'];
    this.searchable = model.attributes.searchable;
    this.plugin = plugins.fieldType(this.fieldType);

    if (model.relationships && model.relationships.constraints && model.relationships.constraints.data) {
      this.constraints = model.relationships.constraints.data.map(ref => constraints.get(ref.id)).filter(Boolean);
    } else {
      this.constraints = [];
    }
  }
  async validationErrors(value) {
    if (value != null && !this.plugin.valid(value)) {
      return [new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`)];
    }
    return (await Promise.all(this.constraints.map(constraint => constraint.validationErrors(value)))).reduce((a,b) => a.concat(b), []).map(message => new Error(`the value of field "${this.id}" ${message}`));
  }
  mapping() {
    return Object.assign({}, this.plugin.defaultMapping(), {
      index: this.searchable
    });
  }
  get sortFieldName() {
    if (this.plugin.sortFieldName) {
      return this.plugin.sortFieldName(this.id);
    } else {
      return this.id;
    }
  }
};
