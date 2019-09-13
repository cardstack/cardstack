import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from "ember-concurrency";

export default class CardLoader extends Component {
  @service cardLoader;

  @tracked errorMsg;
  @tracked loadedCard;
  @tracked cardName;
  @tracked format

  get cardComponent() {
    return `cards/${this.cardName}-${this.format}`;
  }

  @task(function * () {
    this.errorMsg = null;
    this.loadedCard = null;
    try {
      yield this.cardLoader.loadCard(this.cardName, this.format);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.errorMsg = e.message;
      return;
    }
    this.loadedCard = this.cardName;
  }) loadCard;

  @action
  load() {
    if (!this.cardName || !this.format) { return; }
    this.loadCard.perform();
  }
}