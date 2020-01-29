import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { dasherize } from '@ember/string';

export default class CardsAddController extends Controller {
  @service router;
  @service data;

  @tracked name;

  @action
  updateCardName(name) {
    this.name = name;
  }

  get cardId() {
    return dasherize(this.name).toLowerCase();
  }

  @action
  createCard() {
    let newCard = this.data.createCard(`local-hub::${this.cardId}`);

    this.router.transitionTo('cards.card.edit', newCard);
  }
}
