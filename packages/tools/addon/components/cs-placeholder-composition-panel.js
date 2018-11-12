import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-placeholder-composition-panel';
import injectOptional from 'ember-inject-optional';
import { transitionTo } from '../private-api';

export default Component.extend({
  layout,
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: service('cardstack-tools'),
  actions: {
    create() {
      let { name, params, queryParams } = this.get('cardstackRouting').routeForNew(
        this.get('model.type'),
        this.get('tools.branch'),
      );
      queryParams.routingId = this.get('model.slug');
      transitionTo(getOwner(this), name, params.map(p => p[1]), queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
      this.get('tools').setEditing(true);
    },
  },
});
