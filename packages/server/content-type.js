const Error = require('@cardstack/data-source/error');

module.exports = class ContentType {
  constructor(model, allFields, dataSources, allGrants) {
    let fields = new Map();
    for (let fieldRef of model.relationships.fields.data) {
      let field = allFields.get(fieldRef.id);
      if (!field) {
        throw new Error(`content type "${model.id}" refers to missing field "${fieldRef.id}"`);
      }
      fields.set(fieldRef.id, field);
    }
    this.fields = fields;
    this.id = model.id;
    if (model.relationships['data-source']) {
      this.dataSource = dataSources.get(model.relationships['data-source'].data.id);
    } else {
      this.dataSource = null;
    }
    this.grants = allGrants.filter(g => g.types == null || g.types.includes(model.id));
  }

  async validate(pendingChange, context) {
    await this._validateResourceLevelAuthorization(pendingChange, context);

    if (!pendingChange.finalDocument) {
      // when deleting, once we've found a valid resource-level
      // deletion grant we're done -- there's no field-level
      // validation.
      return;
    }

    let errors = [];

    for (let field of this.fields.values()) {
      let fieldErrors = await field.validationErrors(pendingChange, context);
      errors = errors.concat(tagFieldErrors(field, fieldErrors));
    }

    this._validateUnknownFields(pendingChange.finalDocument, errors);

    if (errors.length > 1) {
      let err = errors[0];
      err.additionalErrors = errors.slice(1);
      throw err;
    }
    if (errors.length === 1) {
      throw errors[0];
    }
  }

  _validateUnknownFields(document, errors) {
    if (document.attributes) {
      for (let fieldName of Object.keys(document.attributes)) {
        if (!this.fields.has(fieldName)) {
          errors.push(new Error(`type "${this.id}" has no field named "${fieldName}"`, {
            status: 400,
            title: 'Validation error',
            source: { pointer: `/data/attributes/${fieldName}` }
          }));
        }
      }
    }
    if (document.relationships) {
      for (let fieldName of Object.keys(document.relationships)) {
        if (!this.fields.has(fieldName)) {
          errors.push(new Error(`type "${this.id}" has no field named "${fieldName}"`, {
            status: 400,
            title: 'Validation error',
            source: { pointer: `/data/relationships/${fieldName}` }
          }));
        }
      }
    }
  }

  mapping() {
    let properties = {};
    for (let field of this.fields.values()) {
      properties[field.id] = field.mapping();
    }
    return { properties };
  }

  async _validateResourceLevelAuthorization(pendingChange, context) {
    if (!pendingChange.finalDocument) {
      if (!this.grants.find(g => g['may-delete-resource'] && g.matches(pendingChange.originalDocument, context))) {
        throw new Error("You may not delete this resource", { status: 401 });
      }
    } else if (!pendingChange.originalDocument) {
      if (!this.grants.find(g => g['may-create-resource'] && g.matches(pendingChange.finalDocument, context))) {
        throw new Error("You may not create this resource", { status: 401 });
      }
    } else {
      if (!this.grants.find(
        g => g['may-update-resource'] &&
          g.matches(pendingChange.finalDocument, context) &&
          g.matches(pendingChange.originalDocument, context))
         ) {
        throw new Error("You may not update this resource", { status: 401 });
      }
    }
  }



};

function tagFieldErrors(field, errors) {
  let section = field.isRelationship ? 'relationships' : 'attributes';
  errors.forEach(fe => {
    if (!fe.source) {
      fe.source = { pointer: `/data/${section}/${field.id}` };
    }
  });
  return errors;
}
