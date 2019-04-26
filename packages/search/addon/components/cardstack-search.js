import Component from '@ember/component';
import { observer, computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { task, timeout } from 'ember-concurrency';
import { pluralize, singularize } from 'ember-inflector';
import { A } from '@ember/array';
import { resolve } from 'rsvp';
import qs from 'qs';
import layout from '../templates/components/cardstack-search';

export default Component.extend({
  layout,
  tagName: '',
  store: service(),
  ajax: service(),
  cardstackSession: service(),
  liquidFireTransitions: service(),

  init() {
    this._super(...arguments);

    if (this.get('type')) {
      this.get('search').perform();
    }
  },

  search: task(function * (cursor, debounce) {
    if (debounce) {
      yield timeout(300);
    }

    let query = this.get('query');
    let restQuery = Object.assign({}, query);

    let token = this.get('cardstackSession.token');
    let sort = this.get('sort');
    if (sort) {
      restQuery.sort = sort;
    }
    let pageSize = this.get('pageSize');
    if (pageSize) {
      restQuery.page = { size: pageSize };
    }

    if (cursor) {
      restQuery.page = { cursor };
    }

    // TODO how to handle the scenario where no this.type is specified?
    let adapter = this.get('store').adapterFor(this.type);

    // searching while animating results in lots of jank...
    yield resolve(this.get('liquidFireTransitions').waitUntilIdle());

    let response = yield this.get('ajax').request(`/${pluralize(this.type) || ''}?${qs.stringify(restQuery)}`, {
      host: adapter.host,
      namespace: adapter.namespace,
      contentType: 'application/vnd.api+json',
      headers: { 'authorization': `Bearer ${token}` }
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

  return A(rawPayload.data.map(model => {
    let ModelClass = store.modelFor(singularize(model.type));

    let jsonApiPayload = serializer.normalizeResponse(store, ModelClass, Object.assign({}, rawPayload, {
      data: model
    }), null, 'query');

    return store.push(jsonApiPayload);
  }));
}
