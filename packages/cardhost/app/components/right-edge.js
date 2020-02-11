import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { task } from 'ember-concurrency';
import fade from 'ember-animated/transitions/fade';
import resize from 'ember-animated/motions/resize';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { remove } from 'lodash';
import ENV from '@cardstack/cardhost/config/environment';

const { animationSpeed } = ENV;
const duration = 250;

export default class RightEdge extends Component {
  @tracked cardName = this.args.card.csTitle;
  @tracked cardSelected = this.args.cardSelected;
  @tracked options = {};
  @tracked expandedSections = ['template'];

  fade = fade;
  duration = animationSpeed || duration;

  constructor(...args) {
    super(...args);

    if (this.args.updateCardId) {
      this.toggleSection('details');
    }
  }

  get selectedContent() {
    return this.args.cardSelected ? 'card' : 'field';
  }

  @action
  updateCard(element, [card, cardSelected]) {
    this.cardName = card.csTitle;
    set(this.options, 'selectedContent', cardSelected ? 'card' : 'field');
  }

  @(task(function*(name) {
    if (!this.args.setCardValue) {
      return;
    }
    yield this.args.setCardValue.perform('csTitle', name);
  }).restartable())
  updateCardName;

  @action
  toggleSection(section) {
    if (this.expandedSections.includes(section)) {
      remove(this.expandedSections, i => section === i);
    } else {
      this.expandedSections.push(section);
    }
    // eslint-disable-next-line no-self-assign
    this.expandedSections = this.expandedSections; // oh glimmer, you so silly...
  }

  *outerTransition({ keptSprites }) {
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut, duration });
    });
  }
}
