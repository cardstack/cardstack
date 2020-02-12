import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { cardDocument } from '@cardstack/core/card-document';
import { getUserRealm } from '../utils/scaffolding';

export default class CardNameDialog extends Component {
  @service router;
  @service data;
  @tracked name;

  @action
  updateCardName(name) {
    this.name = name;
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
    // TODO need to handle adoptedFrom arg
    let newCard = yield this.data.create(
      getUserRealm(),
      cardDocument().withAttributes({
        csTitle: this.name,
      }).jsonapi
    );
    let savedCard = yield this.data.save(newCard);
    this.router.transitionTo('cards.card-v2.edit', savedCard);
  })
  createCardTask;

  @action
  createCard() {
    this.createCardTask.perform();
  }
}
