import { inject as service } from '@ember/service';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { pluralize } from 'ember-inflector';
import { get } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cs-field-overlays';

export default Component.extend({
  layout,
  classNames: ['cardstack-tools'],

  tools: service('cardstack-tools'),
  cardstackRouting: service(),
  router: service(),

  actions: {
    openField(which) {
      this.get('tools').openField(which);
    },

    navigateToCard(model) {
      let routingId;
      let type = pluralize(modelType(model));
      if (model.constructor.routingField) {
        routingId = get(model, model.constructor.routingField);
      } else {
        routingId = get(model, 'id');
      }

      // TODO: I don't know why the defaultBranch is not working here
      let { name, params, queryParams } = this.get('cardstackRouting').routeFor(
        type,
        routingId,
        defaultBranch || 'master',
      );

      this.get('router').transitionTo(name, ...params.map(p => p[1]), { queryParams });
    },
  },
});
