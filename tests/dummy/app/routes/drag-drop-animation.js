import BoxelizedRoute from 'boxel/routes/boxelized';

export default class DragDropAnimationRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return this.store.findRecord('article', 'sample');
  }

  setupController(controller, model) {
    controller.set('model', model);
    controller.set('leftWell', [model]);
  }
}
