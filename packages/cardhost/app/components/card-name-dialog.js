import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { dasherize } from '@ember/string';
import { task } from 'ember-concurrency';

export default class CardNameDialog extends Component {
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

  get title() {
    return this.args.title || 'Create a New Card';
  }

  willDestroy() {
    if (this.args.closeDialog) {
      this.args.closeDialog();
    }
  }

  @task(function*() {
    let adoptedFrom;

    if (this.args.model) {
      adoptedFrom = yield this.data.getCard(`local-hub::${this.args.model.name}`, 'isolated');
    }

    let newCard = this.data.createCard(`local-hub::${this.cardId}`, adoptedFrom);

    if (adoptedFrom) {
      this.router.transitionTo('cards.card.edit', newCard);
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
