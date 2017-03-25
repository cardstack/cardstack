import Ember from 'ember';

export default Ember.Mixin.create({
  //branchModels: Ember.inject.service('-cs-branch-models'),


  _branchFromSnapshot(snapshot) {
    let { adapterOptions } = snapshot;
    if (adapterOptions && adapterOptions.branch != null) {
      return adapterOptions.branch;
    } else {
      return 'default';
    }
  },

  findRecord(store, type, id, snapshot) {
    let branch = this._branchFromSnapshot(snapshot);
    return this._super(store, type, id, snapshot).then(response => {
      console.log(`loaded ${type.modelName} ${id} from ${branch}`);
      return response;
    });
  },

  buildQuery(snapshot) {
    let query = this._super(snapshot);
    if (snapshot.adapterOptions && snapshot.adapterOptions.branch) {
      query.branch = snapshot.adapterOptions.branch;
    }
    return query;
  }

});
