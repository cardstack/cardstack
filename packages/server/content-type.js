const Error = require('@cardstack/data-source/error');

module.exports = class ContentType {
  constructor(model, allFields, dataSources) {
    let fields = new Map();
    for (let fieldRef of model.relationships.fields.data) {
      fields.set(fieldRef.id, allFields.get(fieldRef.id));
    }
    this.fields = fields;
    this.id = model.id;
    if (model.relationships['data-source']) {
      this.dataSource = dataSources.get(model.relationships['data-source'].data.id);
    } else {
      this.dataSource = null;
    }
  }
  async validationErrors(document) {
    let errors = [];
    let seen = new Map();
    if (document.attributes) {
      for (let fieldName of Object.keys(document.attributes)) {
        let field = this.fields.get(fieldName);
        if (!field) {
          errors.push(new Error(`type "${this.id}" has no field named "${fieldName}"`));
        } else {
          errors = errors.concat(await field.validationErrors(document.attributes[fieldName], document));
          seen.set(fieldName, true);
        }
      }
    }
    for (let [fieldName, field] of this.fields.entries()) {
      if (field && !seen.get(fieldName)) {
        errors = errors.concat(await field.validationErrors(null, document));
      }
    }
    return errors;
  }
  mapping() {
    let properties = {};
    for (let field of this.fields.values()) {
      properties[field.id] = field.mapping();
    }
    return { properties };
  }
};
