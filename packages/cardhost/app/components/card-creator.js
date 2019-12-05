import { action } from '@ember/object';
import CardManipulator from "./card-manipulator";

export default class CardCreator extends CardManipulator {
  constructor(...args) {
    super(...args);

    /*
      Remove `hide-in-percy` css selectors from places
      where we display card IDs once we remove this
    */
    let defaultCardId = `new-card-${Math.floor(Math.random() * 1E7)}`;

    this.updateCardId(defaultCardId);
    this.cardId = defaultCardId;
  }

  @action
  updateCardId(id) {
    let newCard = this.data.createCard(`local-hub::${id}`, this.args.adoptedFrom);
    if (this.card) {
      for (let field of this.card.fields.filter(i => !i.isAdopted)) {
        newCard.addField(field);
      }
    }
    this.card = newCard;
  }
}