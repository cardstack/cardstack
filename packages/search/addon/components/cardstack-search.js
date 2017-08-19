import Ember from 'ember';
import layout from '../templates/components/cardstack-search';
import { task } from 'ember-concurrency';
import { singularize } from 'ember-inflector';
import { timeout } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  tagName: '',
  store: Ember.inject.service(),

  search: task(function * (cursor, debounce) {
    if (debounce) {
      yield timeout(300);
    }
    let query = this.get('query');
    if (!query) {
      this.set('items', []);
      this.set('links', null);
      return;
    }
    if (!query.type) {
      Ember.warn("cardstack-search queries must have a `type`", false, { id: 'cardstack-search-needs-type' });
      this.set('items', []);
      this.set('links', null);
    } else {
      let restQuery = Object.assign({}, query, { type: undefined });
      if (cursor) {
        restQuery.page = { cursor };
      }
      let records = yield this.get('store').query(singularize(query.type), restQuery);
      if (cursor) {
        this.get('items.content').pushObjects(records.content);
        this.set('links', records.links);
      } else {
        this.set('items', records);
        this.set('links', records.links);
      }

    }
  }).on('init').restartable(),

  research: Ember.observer('query', function() {
    this.get('search').perform(null, true);
  }),

  cursor: Ember.computed('links', function() {
    let nextUrl = this.get('links.next');
    if (nextUrl) {
      return new URL(nextUrl).searchParams.get('page[cursor]');
    }
  })

});
