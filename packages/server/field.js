const Error = require('@cardstack/data-source/error');

module.exports = class Field {
  constructor(model, plugins, constraints) {
    this.id = model.id;
    this.fieldType = model.document['field-type'];
    this.plugin = plugins.fieldType(this.fieldType);
    this.constraints = (model.document.constraints || { data:[] }).data.map(ref => constraints.get(ref.id)).filter(Boolean);
  }
  async validationErrors(value) {
    if (value != null && !this.plugin.valid(value)) {
      return [new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`)];
    }
    return (await Promise.all(this.constraints.map(constraint => constraint.validationErrors(value)))).reduce((a,b) => a.concat(b), []).map(message => new Error(`the value of field "${this.id}" ${message}`));
  }
  mapping() {
    return this.plugin.defaultMapping();
  }
};
