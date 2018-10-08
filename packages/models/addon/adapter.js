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
    let { onlyValidate } = snapshot.adapterOptions;
    if (onlyValidate) {
      return `${url}?onlyValidate=true`
    }
    return url;
  },

  ajaxOptions() {
    let hash = this._super(...arguments);

    if (this.get('cardstackSession')) {
      // @cardstack/authentication is available. If it has a valid
      // session, apply the token to our request

      let { beforeSend } = hash;
      let token = this.get('session.data.authenticated.data.meta.token');

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
