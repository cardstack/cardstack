import BoxelizedRoute from '@cardstack/boxel/routes/boxelized';

export default class DemoDragDropAnimationRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return this.store.findRecord('article', 'sample');
  }

  setupController(controller, model) {
    controller.set('model', model);
    controller.set('leftWell', [model]);
  }
}
