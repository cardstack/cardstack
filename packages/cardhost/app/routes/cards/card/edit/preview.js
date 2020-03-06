import CardModelRoute from '../card-model-route';

export default class PreviewCardRoute extends CardModelRoute {
  beforeModel(transition) {
    let cardsController = this.controllerFor('cards');
    if (transition.urlMethod) {
      cardsController.set('previousTransition', transition.from);
    } else {
      cardsController.set('previousTransition', null);
    }
  }
}
