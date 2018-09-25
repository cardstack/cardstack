import { observer, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-search';
import { task } from 'ember-concurrency';
import { singularize } from 'ember-inflector';
import { timeout } from 'ember-concurrency';
import qs from 'qs';

export default Component.extend({
  layout,
  tagName: '',
  store: service(),
  ajax: service(),

  search: task(function * (cursor, debounce) {
    if (debounce) {
      yield timeout(300);
    }

    let query = this.get('query');

    if (!query) {
      this.set('items', []);
      this.set('links', null);
      this.set('meta', null);
      return;
    }

    let restQuery = Object.assign({}, query);

    if (cursor) {
      restQuery.page = { cursor };
    }

    let adapter = this.get('store').adapterFor('article');

    let response = yield this.get('ajax').request(`/${this.type || ''}?${qs.stringify(restQuery)}`, {
      host: adapter.host,
      namespace: adapter.namespace,
    });

    let models = pushMixedPayload(this.get('store'), response);

    if (cursor) {
      this.get('items').pushObjects(models);
    } else {
      this.set('items', models);
    }

    this.set('links', response.links);
    this.set('meta', response.meta)
  }).on('init').restartable(),

  research: observer('query', function() {
    this.get('search').perform(null, true);
  }),

  cursor: computed('links', function() {
    let nextUrl = this.get('links.next');
    if (nextUrl) {
      return new URL(nextUrl).searchParams.get('page[cursor]');
    }
  })

});

function pushMixedPayload(store, rawPayload) {
  let serializer = store.serializerFor('application');

  return rawPayload.data.map(model => {
    let ModelClass = store.modelFor(singularize(model.type));

    let jsonApiPayload = serializer.normalizeResponse(store, ModelClass, Object.assign({}, rawPayload, {
      data: model
    }), null, 'query');

    return store.push(jsonApiPayload);
  });
}
