import qs from 'qs';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default Route.extend({
  store: service(),
  cardstackEdges: service(),
  cardstackData: service(),
  headData: service(),
  service: service('cardstack-routing'),

  _commonModelHook(path, transition) {
    let { branch } = this.modelFor('cardstack');
    let queryParams = '';

    if (Object.keys(transition.queryParams).length) {
      queryParams = `?${qs.stringify(transition.queryParams, { encodeValuesOnly: true })}`;
    }

    return this.get('store').findRecord('space', `${path.charAt(0) !== '/' ? '/' : ''}${path}${queryParams}`, { adapterOptions: { branch }, reload: true })
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
    this.get('cardstackEdges').registerTopLevelComponent('head-layout');
  },

  updatePageTitle: task(function* (card) {
    if (!card) { return; }

    let title = yield this.cardstackData.getCardMetadata(card, 'title');
    this.headData.set('title', title);
  }).keepLatest(),

  afterModel(model) {
    this.updatePageTitle.perform(model.get('primaryCard'));
  }
});

function is404(err) {
  return err.isAdapterError && err.errors && err.errors.length > 0 && (
    err.errors[0].code === 404 || err.errors[0].status === "404"
  );
}