const Error = require('@cardstack/data-source/error');

module.exports = class Field {
  constructor(model, plugins) {
    this.id = model.id;
    this.fieldType = model.document['field-type'];
    this.plugin = plugins.fieldType(this.fieldType);
  }
  async validationErrors(value) {
    if (!this.plugin.valid(value)) {
      return [new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`)];
    }
    return [];
  }
};
