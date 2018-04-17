const Error = require('@cardstack/plugin-utils/error');
const find = require('../async-find');
const { flatten } = require('lodash');
const Realms = require('./realms');
const authLog = require('@cardstack/logger')('cardstack/auth');

module.exports = class ContentType {
  constructor(model, allFields, allConstraints, dataSources, defaultDataSource, allGrants) {
    let fields = new Map();
    if (model.relationships && model.relationships.fields) {
      for (let fieldRef of model.relationships.fields.data) {
        let field = allFields.get(fieldRef.id);
        if (!field) {
          throw new Error(`content type "${model.id}" refers to missing field "${fieldRef.id}"`, {
            status: 400,
            title: 'Broken field reference'
          });
        }
        fields.set(fieldRef.id, field);
      }
    }

    // type and id fields are always implicitly present
    fields.set('type', allFields.get('type'));
    fields.set('id', allFields.get('id'));

    this.fields = fields;
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
    this._realms = null;
    authLog.trace(`while constructing content type %s, %s of %s grants apply`, this.id, this.grants.length, allGrants.length);
    this.constraints = allConstraints.filter(constraint => {
      return Object.values(constraint.fieldInputs).some(field => this.fields.get(field.id));
    });
    this.routingField = model.attributes && model.attributes['routing-field'];

    if (model.attributes && model.attributes['default-includes']) {
      this.includesTree = buildSearchTree(model.attributes['default-includes']);
    } else {
      this.includesTree = Object.create(null);
    }

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

    for (let field of this.fields.values()) {
      await field.applyDefault(pendingChange, context);
    }

    let errors = [];
    let badFields = Object.create(null);
    for (let field of this.fields.values()) {
      let fieldErrors = await field.validationErrors(pendingChange, context);
      if (fieldErrors.length > 0) {
        badFields[field.id] = true;
      }
      errors = errors.concat(tagFieldErrors(field, fieldErrors));
    }

    errors = errors.concat(await this._checkConstraints(pendingChange, badFields));

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

  async _checkConstraints(pendingChange, badFields) {
    let activeConstraints = this.constraints.filter(constraint => Object.values(constraint.fieldInputs).every(field => !badFields[field.id]));
    return flatten(await Promise.all(activeConstraints.map(constraint => constraint.validationErrors(pendingChange, this.fields))));
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
      Object.assign(properties, field.mapping(this.includesTree, this.allFields));
    }
    return { properties };
  }

  customAnalyzers() {
    let analyzers;
    for (let field of this.fields.values()) {
      let analyzer = field.customAnalyzer();
      if (analyzer) {
        if (!analyzers) {
          analyzers = {};
        }
        Object.assign(analyzers, analyzer);
      }
    }
    return analyzers;
  }

  async _assertGrant(documents, context, permission, description) {
    let grant = await find(this.grants, async g => {
      if (!g[permission]) {
        return false;
      }
      let documentMatches = await Promise.all(documents.map(document => g.matches(document, context)));
      return documentMatches.every(Boolean);
    });
    if (grant) {
      authLog.debug("approved %s of %s %s because of grant %s", description, documents[0].type, documents[0].id, grant.id);
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
    let { originalDocument, finalDocument } = pendingChange;
    if (!finalDocument) {
      await this._assertGrant([originalDocument], context, 'may-delete-resource', 'delete');
    } else if (!originalDocument) {
      await this._assertGrant([finalDocument], context, 'may-read-resource', 'read (during create)');
      await this._assertGrant([finalDocument], context, 'may-create-resource', 'create');
    } else {
      await this._assertGrant([finalDocument, originalDocument], context, 'may-read-resource', 'read (during update)');
      await this._assertGrant([finalDocument, originalDocument], context, 'may-update-resource', 'update');
    }
  }

  get realms() {
    if (!this._realms) {
      this._realms = new Realms(this.grants);
    }
    return this._realms;
  }

  authorizedReadRealms(resource) {
    return this.realms.authorizedReadRealms(resource);
  }

  hasLoginAuthorization(userRealms) {
    return this.realms.mayLogin(userRealms);
  }

  applyReadAuthorization(resource, userRealms) {
    if (!this.realms.mayReadResource(resource, userRealms)) {
      return;
    }
    if (this.realms.mayReadAllFields(resource, userRealms)) {
      return resource;
    }
    let output = { type: resource.type, id: resource.id };
    if (resource.meta) {
      output.meta = resource.meta;
    }
    for (let section of ['attributes', 'relationships']) {
      if (resource[section]) {
        for (let [fieldName, value] of Object.entries(resource[section])) {
          if (this.realms.hasExplicitFieldGrant(resource, userRealms, fieldName)) {
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
