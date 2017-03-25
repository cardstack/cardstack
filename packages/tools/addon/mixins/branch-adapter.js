import Ember from 'ember';

export default Ember.Mixin.create({
  //branchModels: Ember.inject.service('-cs-branch-models'),

  findRecord(store, type, id, snapshot) {
    let url = this.buildURL(type.modelName, id, snapshot, 'findRecord');
    let query = this.buildQuery(snapshot);
    let { adapterOptions } = snapshot;
    let branch;
    if (adapterOptions && adapterOptions.branch) {
      branch = adapterOptions.branch;
      query.branch = branch;
    }
    return this.ajax(url, 'GET', { data: query }).then(response => {
      if (branch) {
        console.log(`loaded ${type.modelName} ${id} from ${branch}`);
      }
      return response;
    });
  }

});
