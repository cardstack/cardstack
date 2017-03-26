import Ember from 'ember';
import DS from 'ember-data';

export default Ember.Mixin.create({
  defaultSerializer: 'cardstack-resource-metadata',
  resourceMetadata: Ember.inject.service(),
  cardstackRouting: Ember.inject.service(),
  _defaultBranch: Ember.computed.alias('cardstackRouting.defaultBranch'),

  shouldReloadRecord(store, snapshot) {
    let requestedBranch = this._branchFromSnapshot(snapshot);
    let haveBranch = this.get('resourceMetadata').read(snapshot.record).get('branch');
    return requestedBranch !== haveBranch;
  },

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
    let upstreamQuery = Object.assign({}, query);
    upstreamQuery.page = { size: 1 };
    delete upstreamQuery.isGeneric
    if (branch === this.get('_defaultBranch')) {
      delete upstreamQuery.branch;
    }
    return this._super(store, type, upstreamQuery).then(response => {
      if (!response.data || !Array.isArray(response.data) || response.data.length < 1) {
        throw new DS.AdapterError([ { code: 404, title: 'Not Found', detail: 'branch-adapter queryRecord got less than one record back' } ]);
      }
      if (!query.isGeneric) {
        this.get('resourceMetadata').write({ type: type.modelName, id: response.data[0].id }, { branch });
      }
      let returnValue = {
        data: response.data[0],
      };
      if (response.meta){
        returnValue.meta = response.meta;
      }
      return returnValue;
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
