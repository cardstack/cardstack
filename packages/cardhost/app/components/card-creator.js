import { action } from '@ember/object';
import CardManipulator from "./card-manipulator";

export default class CardCreator extends CardManipulator {
  constructor(...args) {
    super(...args);

    let defaultCardId = `new-card-${Math.floor(Math.random() * 1E7)}`;

    this.updateCardId(defaultCardId);
    this.cardId = defaultCardId;
  }

  @action
  updateCardId(id) {
    this.card = this.data.createCard(`local-hub::${id}`);
  }
}