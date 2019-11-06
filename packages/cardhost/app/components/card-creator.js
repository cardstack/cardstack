import { action } from '@ember/object';
import CardManipulator from "./card-manipulator";

export default class CardCreator extends CardManipulator {
  constructor(...args) {
    super(...args);

    let defaultCardId = 'default-card-id';

    this.updateCardId(defaultCardId);
    this.cardId = defaultCardId;
  }

  @action
  updateCardId(id) {
    this.card = this.data.createCard(`local-hub::${id}`);
  }
}