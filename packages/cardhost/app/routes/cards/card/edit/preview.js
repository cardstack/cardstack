import CardModelRoute from '../card-model-route';

export default class PreviewCardRoute extends CardModelRoute {
  beforeModel(transition) {
    let cardsController = this.controllerFor('cards');
    cardsController.set('previousTransition', transition.from);
  }
}
