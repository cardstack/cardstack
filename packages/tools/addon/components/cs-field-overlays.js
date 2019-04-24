import { inject as service } from '@ember/service';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { urlForModel } from '@cardstack/routing/helpers/cardstack-url';
import { warn } from '@ember/debug';
import { pluralize } from 'ember-inflector';
import { get } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cs-field-overlays';

export default Component.extend({
  layout,
  classNames: ['cardstack-tools', 'cs-field-overlays'],

  tools: service('cardstack-tools'),
  cardstackRouting: service(),
  router: service(),

  actions: {
    openField(which) {
      this.get('tools').openField(which);
    },

    navigateToCard(model) {
      let path = urlForModel(this, model);
      if (path) {
        let { name, params, queryParams } = this.get('cardstackRouting').routeFor(path);

        this.get('router').transitionTo(name, ...params.map(p => {
          if (p[1].charAt('0') === '/') {
            return p[1].replace('/', ''); // looks like ember router prepends an extra '/' to the path
          }
          return p[1];
        }), { queryParams });
      } else {
        let type = pluralize(modelType(model));
        warn(`The model ${pluralize(type)}/${get(model, 'id')} is not routable, there is no links.self for this model from the API.`);
      }
    }
  }
});
