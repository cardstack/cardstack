import Ember from 'ember';

export default Ember.Mixin.create({
  //branchModels: Ember.inject.service('-cs-branch-models'),


  _defaultbranch: 'default',

  _branchFromSnapshot(snapshot) {
    let { adapterOptions } = snapshot;
    if (adapterOptions && adapterOptions.branch != null) {
      return adapterOptions.branch;
    } else {
      return this._defaultBranch;
    }
  },

  findRecord(store, type, id, snapshot) {
    let branch = this._branchFromSnapshot(snapshot);
    return this._super(store, type, id, snapshot).then(response => {
      console.log(`loaded ${type.modelName} ${id} from ${branch} via findRecord`);
      return response;
    });
  },

  queryRecord(store, type, query) {
    let branch = query.branch != null ? query.branch : this._defaultBranch;
    let id = query.id;
    if (id == null) {
      throw new Error('branch-adapter requires an id parameter in queryRecord queries');
    }
    let url = this.buildURL(type.modelName, query.id);
    let upstreamQuery = Object.assign({}, query);
    delete upstreamQuery.id;
    delete upstreamQuery.isGeneric
    return this.ajax(url, 'GET', { data: upstreamQuery }).then(response => {
      if (query.isGeneric) {
        console.log(`loaded ${type.modelName} ${id} from ${branch} via queryRecord as a cardstack-generic`);
      } else {
        console.log(`loaded ${type.modelName} ${id} from ${branch} via queryRecord`);
      }
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
