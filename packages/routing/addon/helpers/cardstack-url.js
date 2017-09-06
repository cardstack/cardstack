import Ember from 'ember';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { defaultBranch } from '@cardstack/hub/environment';
import { pluralize } from 'ember-inflector';
import { hrefTo } from 'ember-href-to/helpers/href-to';

export function cardstackUrl(context, model, { branch }) {
  if (model) {
    let type = pluralize(modelType(model));
    let routingId;
    if (model.constructor.routingField) {
      routingId = Ember.get(model, model.constructor.routingField);
    } else {
      routingId = Ember.get(model, 'id');
    }
    let { name, params, queryParams } = Ember.get(context, 'cardstackRouting').routeFor(type, routingId, branch || defaultBranch);
    return hrefTo(context, name, ...params.map(p => p[1]), { isQueryParams: true, values: queryParams });
  }
}

export default Ember.Helper.extend({
  cardstackRouting: Ember.inject.service(),
  compute([model], hash) {
    return cardstackUrl(this, model, hash);
  }
});
