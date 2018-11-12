import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import Route from '@ember/routing/route';

export default Route.extend({
  service: service('cardstack-routing'),
  queryParams: {
    // optionally prefill the routingId for the new record
    routingId: {
      refreshModel: true,
    },
  },

  model({ type }, transition) {
    let { routingId } = transition.queryParams;
    let branch = this.modelFor('cardstack').branch;
    let modelType = this.get('service').modelType(type, branch);

    if (routingId == null) {
      return this.store.createRecord(modelType);
    }

    let initialProperties = Object.create(null);
    let modelClass = getOwner(this).resolveRegistration(`model:${modelType}`);
    if (!modelClass) {
      throw new Error(`@cardstack/routing tried to use model ${modelType} but it does not exist`);
    }
    if (modelClass.routingField) {
      initialProperties[modelClass.routingField] = routingId;
    } else {
      initialProperties.id = routingId;
    }
    return this.store.createRecord(modelType, initialProperties);
  },
});
