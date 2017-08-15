import Ember from 'ember';
import { modelType, routeFor } from '@cardstack/routing';

export default Ember.Route.extend({

  _commonModelHook(type, slug) {
    let { branch } = this.modelFor('cardstack');
    let mType = modelType(type, branch);
    let { name, args, queryParams } = routeFor(type, slug, branch);

    if (this.routeName !== name ||
        args.type && args.type !== type) {
      this.replaceWith(name, ...args, { queryParams });
    }

    let modelClass = Ember.getOwner(this).resolveRegistration(`model:${mType}`);
    if (!modelClass) {
      throw new Error(`@cardstack/routing tried to use model ${mType} but it does not exist`);
    }
    let promise;
    if (modelClass.routingField) {
      promise = this.store.queryRecord(mType, {
        filter: { [modelClass.routingField]: { exact: slug } },
        branch
      });
    } else {
      promise = this.store.findRecord(mType, slug, { branch });
    }

    return promise.catch(err => {
      if (!is404(err)) {
        throw err;
      }
      return {
        isCardstackPlaceholder: true,
        type: mType,
        slug
      };
    });
  }
});


function is404(err) {
  return err.isAdapterError && err.errors && err.errors.length > 0 && err.errors[0].code === 404;
}
