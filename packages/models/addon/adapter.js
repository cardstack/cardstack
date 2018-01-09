import DS from 'ember-data';
import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import Ember from 'ember';
import { hubURL } from '@cardstack/plugin-utils/environment';

export default DS.JSONAPIAdapter.extend(AdapterMixin, {
  host: hubURL,
  namespace: 'api',

  // queryRecord can use the hub's page.size control to just do a
  // query of with a limit of 1.
  async queryRecord(store, type, query) {
    let upstreamQuery = Ember.assign({}, query);
    upstreamQuery.page = { size: 1 };
    let response = await this._super(store, type, upstreamQuery);
    if (!response.data || !Array.isArray(response.data) || response.data.length < 1) {
      throw new DS.AdapterError([ { code: 404, title: 'Not Found', detail: 'branch-adapter queryRecord got less than one record back' } ]);
    }
    let returnValue = {
      data: response.data[0],
    };
    if (response.meta){
      returnValue.meta = response.meta;
    }
    return returnValue;
  }

});
