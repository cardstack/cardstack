import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class IsolatedComponent extends Component {
  @tracked adoptedFromId;
  @tracked fields;

  constructor(...args) {
    super(...args);
    this.loadCard.perform();
  }

  @task(function*() {
    let parent = yield this.args.card.adoptsFrom();
    this.adoptedFromId = parent.canonicalURL;
    this.fields = yield this.args.card.fields();
  })
  loadCard;
}
