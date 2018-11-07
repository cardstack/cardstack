import qs from 'qs';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default Route.extend({
  store: service('store'),
  service: service('cardstack-routing'),

  _commonModelHook(path, transition) {
    let { branch } = this.modelFor('cardstack');
    let queryParams = '';

    if (Object.keys(transition.queryParams).length) {
      queryParams = `?${qs.stringify(transition.queryParams)}`;
    }

    return this.get('store').findRecord('space', `${path.charAt(0) !== '/' ? '/' : ''}${path}${queryParams}`, { branch, reload: true })
      .catch(err => {
        if (!is404(err)) {
          throw err;
        }
        return {
          isCardstackPlaceholder: true,
          path
        };
      });
  },

  setupController(controller, model) {
    this._super(controller, model);
    if (!model) { return; }

    let queryParamsString = model.get('queryParams');
    if (!queryParamsString) { return; }

    let params = qs.parse(queryParamsString.replace('?', ''));
    controller.set('params', params);
  }
});

function is404(err) {
  return err.isAdapterError && err.errors && err.errors.length > 0 && (
    err.errors[0].code === 404 || err.errors[0].status === "404"
  );
}