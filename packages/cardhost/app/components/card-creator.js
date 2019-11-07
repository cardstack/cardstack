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

    // right now when the id changes we bascially throw away the
    // card in progress and create a new card with no fields. A
    // more consistent approach from the UX perspective would be
    // to clone all the fields of the old card into the new card.

    // something like:
    // let newCard = this.data.createCard(`local-hub::${id}`);
    // if (this.card) {
    //   for (let field of this.card.fields) {
    //     newCard.addField(field);
    //   }
    // }
    // this.card = newCard;
  }
}