import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import CardManipulator from "./card-manipulator";

export default class CardCreator extends CardManipulator {
  @service router;

  afterCreate(id) {
    this.router.transitionTo('cards.view', id);
  }

  @action
  updateCardId(id) {
    this.card = this.data.createCard(id, 'isolated');
  }
}