module.exports = class Realms {
  constructor(grants) {
    // set of realms that have read access to the resource
    let resource =  new Set();

    // set of realms that have access to all fields
    let allFields = new Set();

    // keys are field names. values are sets of realms
    let fields = new Map();

    for (let grant of grants) {
      if (grant['may-read-resource']) {
        resource.add(grant.groupId);
      }
      if (grant['may-read-fields'] && (!grant.fields || grant.fields.length === 0)) {
        allFields.add(grant.groupId);
      }
    }

    for (let grant of grants) {
      if (grant['may-read-fields'] && grant.fields && grant.fields.length > 0) {
        for (let field of grant.fields) {
          let realmSet = fields.get(field);
          if (!realmSet) {
            realmSet = new Set();
            fields.set(field, realmSet);
          }
          realmSet.add(grant.groupId);
        }
      }
    }

    this._resourceReaders = resource;
    this._allFieldReaders = allFields;
    this._fieldReaders = fields;
  }

  mayReadResource(resource, userRealms) {
    return Boolean(userRealms.find(realm => this._resourceReaders.has(realm)));
  }

  mayReadAllFields(resource, userRealms) {
    return Boolean(userRealms.find(realm => this._allFieldReaders.has(realm)));
  }

  mayReadField(resource, userRealms, fieldName) {
    return this.mayReadAllFields(resource, userRealms) || this.hasExplicitFieldGrant(resource, userRealms, fieldName);
  }

  hasExplicitFieldGrant(resource, userRealms, fieldName) {
    let allowedRealms = this._fieldReaders.get(fieldName);
    if (allowedRealms) {
      return Boolean(userRealms.find(realm => allowedRealms.has(realm)));
    }
  }

  resourceReaders(/* resource */) {
    return [...this._resourceReaders];
  }

  fieldReaders(/*, resource */) {
    return [];
  }
};
