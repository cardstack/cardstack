import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class EmbeddedComponent extends Component {
  @tracked adoptedFromId;
  @tracked fields;

  constructor(...args) {
    super(...args);
    this.loadCard.perform();
  }

  @task(function*() {
    let parent = yield this.args.card.adoptsFrom();
    this.adoptedFromId = parent.canonicalURL;
    let fields = this.args.card.csFieldSets ? this.args.card.csFieldSets.embedded : [];
    this.fields = yield Promise.all((fields || []).map(field => this.args.card.field(field)));
  })
  loadCard;
}
