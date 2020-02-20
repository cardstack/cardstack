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
    let doc = cardDocument().withAttributes({
      csTitle: this.name,
    });
    if (this.args.adoptsFrom) {
      doc.adoptingFrom(this.args.adoptsFrom);
      let csFieldOrder = this.args.adoptsFrom.csFieldOrder;
      if (csFieldOrder) {
        doc.setAttributes({ csFieldOrder });
      }
    }

    let unsavedCard = yield this.data.create(getUserRealm(), doc.jsonapi);
    let card = yield this.data.save(unsavedCard);
    if (this.args.adoptsFrom) {
      this.router.transitionTo('cards.card.edit', { card });
    } else {
      this.router.transitionTo('cards.card.edit.fields.schema', { card });
    }
  })
  createCardTask;

  @action
  createCard() {
    this.createCardTask.perform();
  }
}
