const Grant = require('./grant');
const { flatten, uniq } = require('lodash');
const log = require('@cardstack/logger')('cardstack/auth');


module.exports = class Realms {
  constructor(grants) {
    // set of realms that have read access to the resource
    let resource =  new Set();
    let dynamicResource =  [];

    // set of realms that have access to all fields
    let allFields = new Set();
    let dynamicAllFields = [];

    // set of realms that are allowed to login
    let canLogin = new Set();

    // keys are field names. values are sets of realms
    let fields = new Map();
    let dynamicFields = new Map();

    for (let grant of grants) {

      let intersectionRealm;

      if (grant.who.find(entry => entry.realmField)) {
        // this grant is field-dependent, so we can't reify it into a
        // concrete realm yet, we need to do that when we're checking
        // it against a particular resource.
      } else {
        // this grant is not field dependent, so we can reify it into
        // a concrete realm in advance.
        intersectionRealm = grant.who.map(entry => entry.staticRealm).sort().join('/');
      }

      if (grant['may-login']) {
        if (intersectionRealm) {
          canLogin.add(intersectionRealm);
        } else {
          throw new Error(`may-login grants may not be field-dependent. This was supposed to be asserted already in the Grant constructor.`);
        }
      }

      if (grant['may-read-resource']) {
        if (intersectionRealm) {
          resource.add(intersectionRealm);
        } else {
          dynamicResource.push(grant.who);
        }
      }

      if (mayReadAllFields(grant)) {
        if (intersectionRealm) {
          allFields.add(intersectionRealm);
        } else {
          dynamicAllFields.push(grant.who);
        }
      }

      if (mayReadLessThanAllFields(grant)) {
        let target, empty, addTo;
        if (intersectionRealm) {
          target = fields;
          empty = () => new Set();
          addTo  = (realmSet) => realmSet.add(intersectionRealm);
        } else {
          target = dynamicFields;
          empty = () => [];
          addTo  = (realmSet) => realmSet.push(grant.who);
        }

        for (let field of grant.fields) {
          let realmSet = target.get(field);
          if (!realmSet) {
            realmSet = empty();
            target.set(field, realmSet);
          }
          addTo(realmSet);
        }
      }
    }

    this._resourceReaders = resource;
    this._dynamicResourceReaders = dynamicResource;
    this._allFieldReaders = allFields;
    this._dynamicAllFieldReaders = dynamicAllFields;
    this._fieldReaders = fields;
    this._dynamicFieldReaders = dynamicFields;
    this._allowedToLogin = canLogin;
  }

  async mayLogin(userRealms) {
    return Boolean(userRealms.find(realm => this._allowedToLogin.has(realm)));
  }

  async mayReadResource(documentContext, userRealms) {
    let matchingRealm = userRealms.find(realm => this._resourceReaders.has(realm));
    if (matchingRealm) {
      log.debug('approved resource read for type=%s id=%s with static realm=%s', documentContext.type, documentContext.id, matchingRealm);
      return true;
    }
    let dynamicRealms = await this._dynamicRealms(this._dynamicResourceReaders, documentContext);
    matchingRealm = userRealms.find(realm => dynamicRealms.includes(realm));
    if (matchingRealm) {
      log.debug('approved resource read for type=%s id=%s wtih dynamic realm=%s', documentContext.type, documentContext.id, matchingRealm);
      return true;
    }
    log.debug('rejected resource read for type=%s id=%s userRealms=%j dynamicRealms=%j staticRealms=%j', documentContext.type, documentContext.id, userRealms, dynamicRealms, [...this._resourceReaders.keys()]);
    return false;
  }

  async mayReadAllFields(documentContext, userRealms) {
    if (userRealms.find(realm => this._allFieldReaders.has(realm))) {
      return true;
    }
    let dynamicRealms = await this._dynamicRealms(this._dynamicAllFieldReaders, documentContext);
    return Boolean(userRealms.find(realm => dynamicRealms.includes(realm)));
  }

  async mayReadField(documentContext, userRealms, fieldName) {
    return await this.mayReadAllFields(documentContext, userRealms) || await this.hasExplicitFieldGrant(documentContext, userRealms, fieldName);
  }

  async hasExplicitFieldGrant(documentContext, userRealms, fieldName) {
    let allowedRealms = this._fieldReaders.get(fieldName);
    if (allowedRealms) {
      if (userRealms.find(realm => allowedRealms.has(realm))) {
        return true;
      }
    }
    allowedRealms = this._dynamicFieldReaders.get(fieldName);
    if (allowedRealms) {
      let dynamicRealms = await this._dynamicRealms(allowedRealms, documentContext);
      return Boolean(userRealms.find(realm => dynamicRealms.includes(realm)));
    }
  }

  async _dynamicRealms(lists, documentContext) {
    return flatten(await Promise.all(lists.map(who => this._dynamicRealm(who, documentContext))));
  }

  async _dynamicRealm(who, documentContext) {
    let singleRealms = [];
    let choiceRealms = [];

    for (let { realmField, staticRealm } of who) {
      if (realmField) {
        let baseRealms = await Grant.readRealmsFromField(documentContext, realmField);
        if (baseRealms.length === 0) {
          // One of our required conditions has no valid choices, so
          // we can short-circuit.
          return [];
        } else if (baseRealms.length === 1) {
          singleRealms.push(baseRealms[0]);
        } else {
          choiceRealms.push(baseRealms);
        }
      } else {
        singleRealms.push(staticRealm);
      }
    }

    return realmIntersections(choiceRealms, singleRealms).map(list => uniq(list).sort().join('/'));
  }

  async authorizedReadRealms(documentContext) {
    let dynamicRealms = await this._dynamicRealms(this._dynamicResourceReaders, documentContext);
    return [...this._resourceReaders].concat(dynamicRealms);
  }

};

function mayReadAllFields(grant) {
  return grant['may-read-fields'] && (!grant.fields || grant.fields.length === 0);
}

function mayReadLessThanAllFields(grant) {
  return grant['may-read-fields'] && grant.fields && grant.fields.length > 0;
}

function realmIntersections(choiceRealms, singleRealms) {
  let nextChoices = choiceRealms[0];
  if (!nextChoices) {
    return singleRealms.length > 0 ? [singleRealms] : [];
  }
  let rest = realmIntersections(choiceRealms.slice(1), singleRealms);
  return nextChoices.map(choice => rest.concat([choice]));
}
