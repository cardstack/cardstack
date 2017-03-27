import Ember from 'ember';
import layout from '../templates/components/cs-create-menu';
import { transitionTo } from '../private-api';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-create-menu'],
  cardstackRouting: Ember.inject.service(),
  tools: Ember.inject.service('cardstack-tools'),

  availableTypes: [
    'article',
    'page'
  ],

  actions: {
    create(which) {
      let { name, args, queryParams } = this.get('cardstackRouting').routeForNew(which, this.get('tools.branch'));
      transitionTo(Ember.getOwner(this), name, args, queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
    }
  }
});
