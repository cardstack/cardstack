import Component from '@glimmer/component';
import move from 'ember-animated/motions/move';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class BaseIsolatedComponent extends Component {
  @tracked adoptedFromId;

  duration = animationSpeed || duration;

  constructor(...args) {
    super(...args);
    this.loadCard.perform();
  }

  @task(function*() {
    let parent = yield this.args.card.adoptsFrom();
    if (parent) {
      this.adoptedFromId = parent.canonicalURL;
    }
  })
  loadCard;

  *transition({ insertedSprites, keptSprites, removedSprites }) {
    if (insertedSprites.length) {
      removedSprites.forEach(fadeOut);
    } else {
      yield Promise.all(removedSprites.map(fadeOut));
    }
    yield Promise.all(keptSprites.map(move));
    insertedSprites.forEach(fadeIn);
  }
}
