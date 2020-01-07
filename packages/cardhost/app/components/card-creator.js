import { action } from '@ember/object';
import CardManipulator from './card-manipulator';
import { schedule } from '@ember/runloop';

export default class CardCreator extends CardManipulator {
  constructor(...args) {
    super(...args);

    /*
      Remove `hide-in-percy` css selectors from places
      where we display card IDs once we remove this
    */
    let defaultCardId = `new-card-${Math.floor(Math.random() * 1e7)}`;

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

    /*
      FIXME: THIS IS A COMPLETE HACK. This problem should go away
      once we clarify how card ids and names work. See:
      https://github.com/cardstack/cardstack/issues/1150
    */
    schedule('afterRender', this, function() {
      document.querySelector('#card__id').focus();
    });
  }
}
