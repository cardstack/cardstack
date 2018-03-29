import Ember from 'ember';
import layout from '../templates/components/cs-create-menu';
import { transitionTo } from '../private-api';
import { task } from 'ember-concurrency';
import injectOptional from 'ember-inject-optional';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-create-menu'],
  tools: Ember.inject.service('cardstack-tools'),
  store: Ember.inject.service(),
  cardstackRouting: injectOptional.service(),

  availableTypes: Ember.computed(function() { return []; }),

  loadAvailableTypes: task(function * () {
    let types = yield this.get('store').query('content-type', { filter: { not: { 'is-built-in' : true } } });
    this.set('availableTypes', types);
  }).on('init'),

  actions: {
    create(which) {
      let { name, params, queryParams } = this.get('cardstackRouting').routeForNew(which.id, this.get('tools.branch'));
      transitionTo(Ember.getOwner(this), name, params.map(p => p[1]), queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
      this.get('tools').setEditing(true);
    }
  }
});
