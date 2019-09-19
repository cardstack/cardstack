import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task } from "ember-concurrency";
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';

export default class CardUpdator extends Component {
  @tracked statusMsg;
  @tracked editingCard;
  @tracked lastSavedCard;

  constructor(...args) {
    super(...args);
    this.lastSavedCard = this.args.card;
    this.editingCard = this.args.card ? JSON.stringify(this.args.card, null, 2) : '';
  }

  get cardData() {
    let card;
    try {
      card = JSON.parse(this.card);
    } catch (e) {
      this.statusMsg = `Cannot parse card document`;
      console.error(`cannot parse card document`); // eslint-disable-line no-console
    }
    return card;
  }

  get card() {
    if (this.lastSavedCard !== this.args.card) {
      this.lastSavedCard = this.args.card;
      let card = this.args.card ? JSON.stringify(this.args.card, null, 2) : '';
      this.editingCard = card;
      return card;
    }

    return this.editingCard;
  }

  get isDirty() {
    return this.card !== JSON.stringify(this.lastSavedCard, null, 2);
  }

  get isDirtyStr() {
    return this.isDirty.toString();
  }

  @task(function * () {
    let json;
    this.statusMsg = null;
    if (!ciSessionId) {
      this.statusMsg = `You must run the hub with the environment variable HUB_ENVIRONMENT=test in order for the hub to provide a session that can be used for the test harness to create cards with.`;
      throw new Error(this.statusMsg);
    }
    try {
      let response = yield fetch(`${hubURL}/api/cards/${this.args.cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${ciSessionId}`
        },
        body: this.card
      });
      json = yield response.json();
      if (!response.ok) {
        this.statusMsg = `Error updating card: ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`;
      }
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = e.message;
      return;
    }
    yield this.args.onCardUpdate();
  }) updateCard;

  @action
  update() {
    try {
      JSON.parse(this.card)
    } catch (e) {
      this.statusMsg = `The card data is invalid JSON`;
      return;
    }

    this.updateCard.perform();
  }
}