import { inject as service } from '@ember/service';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { urlForModel } from '@cardstack/routing/helpers/cardstack-url';
import { warn } from '@ember/debug';
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
      let path = urlForModel(model);
      if (path) {
        // TODO: I don't know why the defaultBranch is not working here
        let { name, params, queryParams } = this.get('cardstackRouting').routeFor(path, defaultBranch || 'master');

        this.get('router').transitionTo(name, ...params.map(p => p[1]), { queryParams });
      } else {
        let type = pluralize(modelType(model));
        warn(`The model ${pluralize(type)}/${get(model, 'id')} is not routable, there is no links.self for this model from the API.`);
      }
    }
  }
});
