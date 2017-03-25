import Ember from 'ember';

export default Ember.Mixin.create({
  resourceMetadata: Ember.inject.service(),
  _defaultBranch: Ember.computed(function() {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    return config.cardstack.defaultBranch;
  }),

  _branchFromSnapshot(snapshot) {
    let { adapterOptions } = snapshot;
    if (adapterOptions && adapterOptions.branch != null) {
      return adapterOptions.branch;
    } else {
      return this.get('_defaultBranch');
    }
  },

  updateRecord(store, type, snapshot) {
    if (!snapshot.adapterOptions) {
      snapshot.adapterOptions = {};
    }
    if (!snapshot.adapterOptions.branch) {
      let meta = this.get('resourceMetadata').read(snapshot.record);
      if (!meta.branch) {
        throw new Error("tried to update a record but I don't know what branch it came from");
      }
      snapshot.adapterOptions.branch = meta.branch;
    }
    return this._super(store, type, snapshot);
  },

  findRecord(store, type, id, snapshot) {
    let branch = this._branchFromSnapshot(snapshot);
    return this._super(store, type, id, snapshot).then(response => {
      this.get('resourceMetadata').write({ type: type.modelName, id }, { branch });
      return response;
    });
  },

  queryRecord(store, type, query) {
    let branch = query.branch != null ? query.branch : this.get('_defaultBranch');
    let id = query.id;
    if (id == null) {
      throw new Error('branch-adapter requires an id parameter in queryRecord queries');
    }
    let url = this.buildURL(type.modelName, query.id);
    let upstreamQuery = Object.assign({}, query);
    delete upstreamQuery.id;
    delete upstreamQuery.isGeneric
    if (branch === this.get('_defaultBranch')) {
      delete upstreamQuery.branch;
    }
    return this.ajax(url, 'GET', { data: upstreamQuery }).then(response => {
      if (!query.isGeneric) {
        this.get('resourceMetadata').write({ type: type.modelName, id }, { branch });
      }
      return response;
    });
  },

  // This will properly set the branch query param from the
  // adapterOptions for everything *except* query and
  // queryRecord. Those two don't pass a snapshot to buildURL and are
  // handled separately above.
  buildURL(modelName, id, snapshot, requestType, query) {
    let url = this._super(modelName, id, snapshot, requestType, query);
    if (snapshot && snapshot.adapterOptions) {
      let { branch } = snapshot.adapterOptions;
      if (branch != null && branch !== this.get('_defaultBranch')) {
        url += '?branch=' + encodeURIComponent(branch);
      }
    }
    return url;
  }

});
