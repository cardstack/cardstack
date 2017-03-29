import Ember from 'ember';
import layout from '../templates/components/cs-create-menu';
import { transitionTo } from '../private-api';
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-create-menu'],
  cardstackRouting: Ember.inject.service(),
  tools: Ember.inject.service('cardstack-tools'),
  store: Ember.inject.service(),

  availableTypes: [],

  loadAvailableTypes: task(function * () {
    let types = yield this.get('store').query('content-type', { filter: { not: { 'is-built-in' : true } } });
    this.set('availableTypes', types);
  }).on('init'),

  actions: {
    create(which) {
      let { name, args, queryParams } = this.get('cardstackRouting').routeForNew(which.id, this.get('tools.branch'));
      transitionTo(Ember.getOwner(this), name, args, queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
    }
  }
});
