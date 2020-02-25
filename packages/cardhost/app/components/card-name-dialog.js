import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { dasherize } from '@ember/string';
import { task } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;

export default class CardNameDialog extends Component {
  @service router;
  @service data;

  @tracked name;

  get cardId() {
    return dasherize(this.name).toLowerCase();
  }

  get title() {
    return this.args.title || 'Create a New Card';
  }

  willDestroy() {
    if (this.args.closeDialog) {
      this.args.closeDialog();
    }
  }

  @action
  updateCardName(name) {
    this.name = name;
  }

  @action
  keyDown(event) {
    if (event.which === 13) {
      this.createCard();
    }
  }

  @task(function*() {
    let adoptedFrom;

    if (this.args.model) {
      adoptedFrom = yield this.data.getCard(`local-hub::${this.args.model.name}`, 'isolated');
    }

    let newCard = this.data.createCard(`local-hub::${this.cardId}`, adoptedFrom);

    if (environment !== 'test') {
      yield newCard.save();
    }

    if (adoptedFrom) {
      this.router.transitionTo('cards.card.edit.fields', newCard);
    } else {
      this.router.transitionTo('cards.card.edit.fields.schema', newCard);
    }
  })
  createCardTask;

  @action
  createCard() {
    this.createCardTask.perform();
  }
}
