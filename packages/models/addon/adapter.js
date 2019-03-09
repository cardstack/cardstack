import { assign } from '@ember/polyfills';
import { get } from '@ember/object';
import DS from 'ember-data';
import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import { hubURL } from '@cardstack/plugin-utils/environment';
import injectOptional from 'ember-inject-optional';

export default DS.JSONAPIAdapter.extend(AdapterMixin, {
  host: hubURL,
  namespace: 'api',
  cardstackSession: injectOptional.service(),
  session: injectOptional.service(),

  pathForType(modelName) {
    if (modelName === 'cardstack-card') {
      return '';
    } else {
      return this._super(...arguments);
    }
  },

  // queryRecord can use the hub's page.size control to just do a
  // query of with a limit of 1.
  async queryRecord(store, type, query) {
    let upstreamQuery = assign({}, query);
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
  },

  buildURL(modelName, id, snapshot, requestType, query) {
    let actualModelName = snapshot && snapshot.modelName || query && query.modelName;
    let url = this._super(actualModelName || modelName, id, snapshot, requestType, query);
    let branchFromSnapshot = snapshot && get(snapshot, 'adapterOptions.branch');
    let branchFromQuery = query && get(query, 'adapterOptions.branch');
    let branch = branchFromSnapshot || branchFromQuery;

    if (branch) {
      url += `?branch=${branch}`;
    }

    return url;
  },

  deleteRecord(store, type, snapshot) {
    let id = snapshot.id;

    let options = {};
    let metaService = this.get('_resourceMetadata');
    let meta = metaService.peek(snapshot.record);
    let version = get(meta, 'version');

    if (version) {
      options.headers = { "If-Match": version };
    }

    // Note: this bypasses the `ds-improved-ajax` feature
    return this.ajax(this.buildURL(type.modelName, id, snapshot, 'deleteRecord'), "DELETE", options);
  },

  urlForCreateRecord(modelName, snapshot) {
    let baseURL = this._super(...arguments);
    return this._addQueryParams(baseURL, snapshot);
  },

  urlForUpdateRecord(id, modelName, snapshot) {
    let baseURL = this._super(...arguments);
    return this._addQueryParams(baseURL, snapshot);
  },

  _addQueryParams(url, snapshot) {
    let { adapterOptions } = snapshot;
    if (adapterOptions && adapterOptions.onlyValidate) {
      return `${url}?onlyValidate=true`
    }
    return url;
  },

  ajaxOptions() {
    let hash = this._super(...arguments);
    let token = this.get('cardstackSession.token');
    if (token) {
      let { beforeSend } = hash;
      hash.beforeSend = (xhr) => {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (beforeSend) {
          beforeSend(xhr);
        }
      };
    }
    return hash;
  },

});
