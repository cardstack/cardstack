import Ember from 'ember';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { pluralize } from 'ember-inflector';
import { hrefTo } from 'ember-href-to/helpers/href-to';

export function urlForModel(context, model, { branch } = {}) {
  if (model) {
    let type = pluralize(modelType(model));
    let routingId;
    if (model.constructor.routingField) {
      routingId = Ember.get(model, model.constructor.routingField);
    } else {
      routingId = Ember.get(model, 'id');
    }
    return urlForParams(context, type, routingId, { branch });
  }
}

export function urlForParams(context, type, routingId, { branch } = {}) {
  if (!type || !routingId) {
    return;
  }
  type = pluralize(type);
  let { name, params, queryParams } = Ember.get(context, 'cardstackRouting').routeFor(type, routingId, branch || defaultBranch);
  return hrefTo(context, name, ...params.map(p => p[1]), { isQueryParams: true, values: queryParams });
}

export default Ember.Helper.extend({
  cardstackRouting: Ember.inject.service(),
  compute(args, hash) {
    if (args.length === 2) {
      let [ type, routingId ] = args;
      return urlForParams(this, type, routingId, hash);
    } else if (args.length === 1) {
      let [ model ] = args;
      return urlForModel(this, model, hash);
    } else {
      throw new Error(`the cardstack-url helper expects either two arguments (type and routingId) or one argument (a model). You passed ${args.length} arguments.`);
    }

  }
});
