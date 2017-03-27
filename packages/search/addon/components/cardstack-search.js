import Ember from 'ember';
import layout from '../templates/components/cardstack-search';
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  store: Ember.inject.service(),
  search: task(function * () {
    if (!this.get('query')) {
      this.set('items', []);
      return;
    }
    let records = yield this.get('store').query('pokemon', this.get('query'));
    this.set('items', records);
  }).observes('query').on('init')
});
