import Ember from 'ember';
export default Ember.Mixin.create({
  normalizeResponse(store, primaryModelClass, payload, id, requestType, isSingle) {
    try {
      if (payload.meta && payload.meta.branch) {
        this._pushingBranch = payload.meta.branch;
      }
      let value = this._super(store, primaryModelClass, payload, id, requestType, isSingle);
      return value;
    } finally {
      this._pushingBranch = null;
    }
  },
  normalize(type, hash) {
    let document = this._super(type, hash);
    if (this._pushingBranch) {
      console.log(`I saw ${hash.type} ${hash.id} on branch ${this._pushingBranch}`);
    } else {
      console.log(`I saw ${hash.type} ${hash.id} on no branch`);
    }
    return document;
  }
});
