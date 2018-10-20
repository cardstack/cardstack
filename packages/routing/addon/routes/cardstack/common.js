import { getOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import Route from '@ember/routing/route';
import { pluralize } from 'ember-inflector';

export default Route.extend({

  service: service('cardstack-routing'),
  store: service('store'),

  _commonModelHook(type, slug) {
    let { branch } = this.modelFor('cardstack');
    let mType = this.get('service').modelType(type, branch);
    let { name, params, queryParams } = this.get('service').routeFor(type, slug, branch);
    let paramMap = Object.create(null);
    params.forEach(([k,v]) => paramMap[k] = v);

    if (this.routeName !== name ||
        (paramMap.type && paramMap.type !== type)) {
      this.replaceWith(name, ...params.map(p => p[1]), { queryParams });
    }

    let modelClass = getOwner(this).resolveRegistration(`model:${mType}`);
    if (!modelClass) {
      throw new Error(`@cardstack/routing tried to use model ${mType} but it does not exist`);
    }

    return this.get('store').findRecord('space', `${pluralize(mType)}/${slug}`, { branch, reload: true })
      .then(space => space.get('primaryCard'))
      .catch(err => {
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
  return err.isAdapterError && err.errors && err.errors.length > 0 && (
    err.errors[0].code === 404 || err.errors[0].status === "404"
  );
}
