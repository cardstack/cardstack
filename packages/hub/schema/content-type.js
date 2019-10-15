const Error = require('@cardstack/plugin-utils/error');
const find = require('../async-find');
const { flatten } = require('lodash');
const Realms = require('./realms');
const authLog = require('@cardstack/logger')('cardstack/auth');
const Session = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/logger')('cardstack/schema/content-type');

module.exports = class ContentType {
  constructor(model, allFields, allComputedFields, allConstraints, dataSources, defaultDataSource, allGrants, allGroups) {

    let realFields = new Map();
    let computedFields = new Map();
    let realAndComputedFields = new Map();

    if (model.relationships && model.relationships.fields) {
      for (let fieldRef of model.relationships.fields.data) {
        let field;
        if ((field = allFields.get(fieldRef.id))) {
          realFields.set(fieldRef.id, field);
          realAndComputedFields.set(fieldRef.id, field);
        } else if ((field = allComputedFields.get(fieldRef.id))) {
          computedFields.set(fieldRef.id, field);
          realAndComputedFields.set(fieldRef.id, field.virtualField);
        } else {
          log.error(`Error broken field:`, console.trace()); //eslint-disable-line no-console
          throw new Error(`content type "${model.id}" refers to missing field "${fieldRef.id}"`, {
            status: 400,
            title: 'Broken field reference'
          });
        }
      }
    }

    // type and id fields are always implicitly present
    realFields.set('type', allFields.get('type'));
    realFields.set('id', allFields.get('id'));
    realAndComputedFields.set('type', allFields.get('type'));
    realAndComputedFields.set('id', allFields.get('id'));

    // the actual fields that are stored in the data source. These are instances of Field.
    this.realFields = realFields;

    // any computed fields that are defined. These are not stored in
    // the data source, we just derive them from other things that
    // are. These are instances of ComputedField.
    this.computedFields = computedFields;

    // this combines both kinds of fields. But these are always
    // instances of Field -- each ComputedField knows how to represent
    // itself as a Field too.
    this.realAndComputedFields = realAndComputedFields;

    this.id = model.id;
    if (model.relationships && model.relationships['data-source'] && model.relationships['data-source'].data) {
      this.dataSource = dataSources.get(model.relationships['data-source'].data.id);
      if (!this.dataSource) {
        throw new Error(`content type "${model.id}" refers to missing data source id "${model.relationships['data-source'].data.id}"`, {
          status: 400,
          title: 'Broken field reference'
        });
      }
    } else if (defaultDataSource) {
      this.dataSource = dataSources.get(defaultDataSource.data.id);
    } else {
      this.dataSource = null;
    }
    this.grants = allGrants.filter(g => g.types == null || g.types.includes(model.id));
    this._groups = allGroups.filter(g => g.types.includes(model.id));
    this._realms = null;
    authLog.trace(`while constructing content type %s, %s of %s grants apply`, this.id, this.grants.length, allGrants.length);
    this.constraints = allConstraints.filter(constraint => {
      return Object.values(constraint.fieldInputs).some(field => this.realFields.get(field.id));
    });
    //TODO we should get rid of this as part of refactoring the content.new route to use the new routing system
    this.routingField = model.attributes && model.attributes['routing-field'];

    if (model.attributes && model.attributes['default-includes']) {
      this.includesTree = buildSearchTree(model.attributes['default-includes']);
    } else {
      this.includesTree = Object.create(null);
    }

    this.router = model.attributes && model.attributes.router;

    if (model.attributes && model.attributes['fieldsets']) {
      let fieldsets = model.attributes['fieldsets'];
      for (let format of Object.keys(fieldsets)) {
        if (!Array.isArray(fieldsets[format])) {
          throw new Error(`content type "${model.id}" contains fieldset for format "${format}" that is not an array: "${JSON.stringify(fieldsets[format])}"`, {
            status: 400,
            title: 'Invalid fieldset'
          });
        }
      }
      this.fieldsets = fieldsets;
    }

    this.fieldsetExpansionFormat = model.attributes && model.attributes['fieldset-expansion-format'];

    this.allFields = allFields;
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
    let badFields = Object.create(null);

    await this._validateFieldReadAuth(pendingChange, context, errors, badFields);

    for (let field of this.realFields.values()) {
      await field.applyDefault(pendingChange, context);
    }

    for (let field of this.realFields.values()) {
      if (!badFields[field.id]) {
        let fieldErrors = await field.validationErrors(pendingChange, context);
        if (fieldErrors.length > 0) {
          badFields[field.id] = true;
        }
        errors = errors.concat(tagFieldErrors(field, fieldErrors));
      }
    }

    errors = errors.concat(await this._checkConstraints(pendingChange, badFields));

    this._validateUnknownFields(pendingChange, errors);

    if (errors.length > 1) {
      let err = errors[0];
      err.additionalErrors = errors.slice(1);
      throw err;
    }
    if (errors.length === 1) {
      throw errors[0];
    }
  }

  // TODO: rename to maybe...Type
  async authorizedToCreateResource(context) {
    let grant = await find(this.grants, async g => {
      if (!g['may-create-resource']) {
        return false;
      }
      return g.matches(null, context);
    });
    return Boolean(grant);
  }

  async _checkConstraints(pendingChange, badFields) {
    let activeConstraints = this.constraints.filter(constraint => Object.values(constraint.fieldInputs).every(field => !badFields[field.id]));
    return flatten(await Promise.all(activeConstraints.map(constraint => constraint.validationErrors(pendingChange, this.realFields))));
  }

  _unknownFieldError(fieldName, section) {
    return new Error(`type "${this.id}" has no field named "${fieldName}"`, {
      status: 400,
      title: 'Validation error',
      source: { pointer: `/data/${section}/${fieldName}` }
    });
  }

  _validateUnknownFields(pending, errors) {
    let { finalDocument, originalDocument } = pending;

    if (finalDocument.attributes) {
      let originalFields = originalDocument && originalDocument.attributes
        ? Object.keys(originalDocument.attributes) : [];

      for (let fieldName of Object.keys(finalDocument.attributes)) {
        if (!this.realFields.has(fieldName) && !originalFields.includes(fieldName)) {
          errors.push(this._unknownFieldError(fieldName, 'attributes'));
        }
      }
    }

    if (finalDocument.relationships) {
      let originalFields = originalDocument && originalDocument.relationships
        ? Object.keys(originalDocument.relationships) : [];

      for (let fieldName of Object.keys(finalDocument.relationships)) {
        if (!this.realFields.has(fieldName) && !originalFields.includes(fieldName)) {
          errors.push(this._unknownFieldError(fieldName, 'relationships'));
        }
      }
    }
  }

  async _assertGrant(documentContexts, context, permission, description) {
    let grant = await find(this.grants, async g => {
      if (!g[permission]) {
        return false;
      }
      let documentMatches = await Promise.all(documentContexts.map(documentContext => g.matches(documentContext, context)));
      return documentMatches.every(Boolean);
    });
    if (grant) {
      authLog.debug("approved %s of %s %s because of grant %s",
        description,
        documentContexts[0] ? documentContexts[0].type : '-undefined-',
        documentContexts[0] ? documentContexts[0].id : '-undefined-',
        grant.id);
      authLog.trace("grant %s = %j", grant.id, grant);
    } else {
      authLog.trace("no matching %s grant for %j in %j", description, context, this.grants);
      if (permission === 'may-read-resource') {
        throw new Error(`Not found`, { status: 404 });
      } else {
        throw new Error(`You may not ${description} this resource`, { status: 401 });
      }
    }
  }

  async _validateResourceLevelAuthorization(pendingChange, context) {
    let { originalDocumentContext, finalDocumentContext } = pendingChange;
    if (!finalDocumentContext) {
      await this._assertGrant([originalDocumentContext], context, 'may-delete-resource', 'delete');
    } else if (!originalDocumentContext) {
      await this._assertGrant([finalDocumentContext], context, 'may-read-resource', 'read (during create)');
      await this._assertGrant([finalDocumentContext], context, 'may-create-resource', 'create');
    } else {
      await this._assertGrant([finalDocumentContext, originalDocumentContext], context, 'may-read-resource', 'read (during update)');
      await this._assertGrant([originalDocumentContext], context, 'may-update-resource', 'update');
    }
  }

  isGroupable() {
    return this._groups.length > 0;
  }

  async groups(documentContext) {
    return (await Promise.all(this._groups.map(async g => (await g.test(documentContext)) && g))).filter(Boolean);
  }

  get realms() {
    if (!this._realms) {
      this._realms = new Realms(this.grants);
    }
    return this._realms;
  }

  async authorizedReadRealms(documentContext) {
    return await this.realms.authorizedReadRealms(documentContext);
  }

  async hasLoginAuthorization(userRealms) {
    return await this.realms.mayLogin(userRealms);
  }

  async applyReadAuthorization(documentContext, userRealms) {
    if (!await this.realms.mayReadResource(documentContext, userRealms)) {
      return;
    }
    let resource = (await documentContext.pristineDoc()).data;
    if (await this.realms.mayReadAllFields(documentContext, userRealms)) {
      return resource;
    }
    let output = { type: resource.type, id: resource.id };
    if (resource.meta) {
      output.meta = resource.meta;
    }
    for (let section of ['attributes', 'relationships']) {
      if (resource[section]) {
        for (let [fieldName, value] of Object.entries(resource[section])) {
          if (await this.realms.hasExplicitFieldGrant(documentContext, userRealms, fieldName)) {
            if (!output[section]) {
              output[section] = {};
            }
            output[section][fieldName] = value;
          }
        }
      }
    }
    return output;
  }

  // this is for internal use during validation of create and update
  async _validateFieldReadAuth(pendingChange, context, errors, badFields) {
    let session = context.session || Session.EVERYONE;
    let userRealms = await session.realms();

    if (await this.realms.mayReadAllFields(pendingChange.finalDocumentContext, userRealms)) {
      return;
    }

    let resource = pendingChange.finalDocument;
    for (let section of ['attributes', 'relationships']) {
      if (resource[section]) {
        for (let fieldName of Object.keys(resource[section])) {
          if (!await this.realms.hasExplicitFieldGrant(pendingChange.finalDocumentContext, userRealms, fieldName)) {
            errors.push(this._unknownFieldError(fieldName, section));
            badFields[fieldName] = true;
          }
        }
      }
    }
  }
};

function tagFieldErrors(field, errors) {
  let pointer = field.pointer();
  errors.forEach(fe => {
    if (!fe.source) {
      fe.source = { pointer };
    }
  });
  return errors;
}

function buildSearchTree(searchableRelationships) {
  let root = Object.create(null);
  for (let path of searchableRelationships) {
    let segments = path.split('.');
    let pointer = root;
    for (let segment of segments) {
      if (!pointer[segment]) {
        pointer[segment] = Object.create(null);
      }
      pointer = pointer[segment];
    }
  }
  return root;
}
