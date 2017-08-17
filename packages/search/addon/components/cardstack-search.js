import Ember from 'ember';
import layout from '../templates/components/cardstack-search';
import { task } from 'ember-concurrency';
import { singularize } from 'ember-inflector';

export default Ember.Component.extend({
  layout,
  tagName: '',
  store: Ember.inject.service(),
  search: task(function * () {
    let query = this.get('query');
    if (!query) {
      this.set('items', []);
      return;
    }
    if (!query.type) {
      Ember.warn("cardstack-search queries must have a `type`", false, { id: 'cardstack-search-needs-type' });
      this.set('items', []);
    } else {
      let restQuery = Object.assign({}, query, { type: undefined });
      let records = yield this.get('store').query(singularize(query.type), restQuery);
      this.set('items', records);
    }
  }).observes('query').on('init')
});
