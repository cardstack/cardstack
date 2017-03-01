const Error = require('@cardstack/data-source/error');

module.exports = class ContentType {
  constructor(model, allFields) {
    let fields = new Map();
    for (let fieldRef of model.document.fields.data) {
      fields.set(fieldRef.id, allFields.get(fieldRef.id));
    }
    this.fields = fields;
    this.id = model.id;
  }
  async validationErrors(document) {
    let errors = [];
    if (document.attributes) {
      for (let fieldName of Object.keys(document.attributes)) {
        let field = this.fields.get(fieldName);
        if (!field) {
          errors.push(new Error(`type "${this.id}" has no field named "${fieldName}"`));
        } else {
          errors = errors.concat(await field.validationErrors(document.attributes[fieldName], document));
        }
      }
    }
    return errors;
  }
};
