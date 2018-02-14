const Grant = require('./grant');

module.exports = class Realms {
  constructor(grants) {
    // set of realms that have read access to the resource
    let resource =  new Set();
    let dynamicResource =  [];

    // set of realms that have access to all fields
    let allFields = new Set();
    let dynamicAllFields = [];

    // keys are field names. values are sets of realms
    let fields = new Map();
    let dynamicFields = new Map();

    for (let grant of grants) {
      if (grant['may-read-resource']) {
        if (grant.groupId != null) {
          resource.add(grant.groupId);
        } else {
          dynamicResource.push(grant.groupField);
        }
      }
      if (grant['may-read-fields'] && (!grant.fields || grant.fields.length === 0)) {
        if (grant.groupId != null) {
          allFields.add(grant.groupId);
        } else {
          dynamicAllFields.push(grant.groupField);
        }
      }
    }

    for (let grant of grants) {
      if (grant['may-read-fields'] && grant.fields && grant.fields.length > 0) {
        if (grant.groupId != null) {
          for (let field of grant.fields) {
            let realmSet = fields.get(field);
            if (!realmSet) {
              realmSet = new Set();
              fields.set(field, realmSet);
            }
            realmSet.add(grant.groupId);
          }
        } else {
          for (let field of grant.fields) {
            let realmSet = dynamicFields.get(field);
            if (!realmSet) {
              realmSet = [];
              dynamicFields.set(field, realmSet);
            }
            realmSet.push(grant.groupField);
          }
        }
      }
    }

    this._resourceReaders = resource;
    this._dynamicResourceReaders = dynamicResource;
    this._allFieldReaders = allFields;
    this._dynamicAllFieldReaders = dynamicAllFields;
    this._fieldReaders = fields;
    this._dynamicFieldReaders = dynamicFields;
  }

  mayReadResource(resource, userRealms) {
    if (userRealms.find(realm => this._resourceReaders.has(realm))) {
      return true;
    }
    let dynamicRealms = this._dynamicResourceReaders.map(fieldName => Grant.readField(resource, fieldName));
    return Boolean(userRealms.find(realm => dynamicRealms.includes(realm)));
  }

  mayReadAllFields(resource, userRealms) {
    if (userRealms.find(realm => this._allFieldReaders.has(realm))) {
      return true;
    }
    let dynamicRealms = this._dynamicAllFieldReaders.map(fieldName => Grant.readField(resource, fieldName));
    return Boolean(userRealms.find(realm => dynamicRealms.includes(realm)));
  }

  mayReadField(resource, userRealms, fieldName) {
    return this.mayReadAllFields(resource, userRealms) || this.hasExplicitFieldGrant(resource, userRealms, fieldName);
  }

  hasExplicitFieldGrant(resource, userRealms, fieldName) {
    let allowedRealms = this._fieldReaders.get(fieldName);
    if (allowedRealms) {
      if (userRealms.find(realm => allowedRealms.has(realm))) {
        return true;
      }
    }
    allowedRealms = this._dynamicFieldReaders.get(fieldName);
    if (allowedRealms) {
      let dynamicRealms = allowedRealms.map(fieldName => Grant.readField(resource, fieldName));
      return Boolean(userRealms.find(realm => dynamicRealms.includes(realm)));
    }
  }

  authorizedReadRealms(resource) {
    let dynamicRealms = this._dynamicResourceReaders.map(fieldName => Grant.readField(resource, fieldName));
    return [...this._resourceReaders].concat(dynamicRealms);
  }

};
