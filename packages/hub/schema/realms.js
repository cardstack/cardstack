module.exports = class Realms {
  constructor(grants) {
    // set of realms that have read access to the resource
    let resource =  new Set();

    // set of realms that have access to all fields
    let allFields = new Set();

    // keys are a sorted concatenation of field names
    // values are pairs of [list of field names, sets of realms]
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
        let sortedFields = grant.fields.slice().sort();

        // jsonapi explicitly forbids field names that contain a "/", so this is safe.
        let key = sortedFields.join('/');

        let pair = fields.get(key);
        if (!pair) {
          pair = [sortedFields, new Set()];
          fields.set(key, pair);
        }
        pair[1].add(grant.groupId);
      }
    }

    this._resource = [...resource];
    this._fields = [...fields.values()].map(([fieldList, realmSet]) => [fieldList, [...realmSet]]);
    this._fields.push(['all', [...allFields]]);
  }

  resourceReaders(/* resource */) {
    return this._resource.slice();
  }

  fieldReaders(/*, resource */) {
    return this._fields.slice();
  }
};
