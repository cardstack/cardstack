import Ember from 'ember';
import layout from '../templates/components/cs-placeholder-composition-panel';
import injectOptional from 'ember-inject-optional';
import { transitionTo } from '../private-api';

export default Ember.Component.extend({
  layout,
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: Ember.inject.service('cardstack-tools'),
  actions: {
    create() {
      let { name, params, queryParams } = this.get('cardstackRouting').routeForNew(this.get('model.type'), this.get('tools.branch'));
      queryParams.routingId = this.get('model.slug');
      transitionTo(Ember.getOwner(this), name, params.map(p => p[1]), queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
      this.get('tools').setEditing(true);
    }
  }
});
