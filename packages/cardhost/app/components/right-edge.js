import Component from '@glimmer/component';
import { fieldComponents } from '@cardstack/core/utils/mappings';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import fade from 'ember-animated/transitions/fade';
import resize from 'ember-animated/motions/resize';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { printSprites } from 'ember-animated';

export default class RightEdge extends Component {
  @tracked cardName = this.args.card.name;
  @tracked cardSelected = this.args.cardSelected;
  @tracked options = {};

  fade = fade;

  get selectedFieldTitle() {
    if (this.args.selectedField) {
      let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
      return title;
    }

    return '';
  }

  get selectedContent() {
    return this.args.cardSelected ? 'card' : 'field';
  }

  @action
  updateCard(element, [card, cardSelected]) {
    this.cardName = card.name;
    set(this.options, 'selectedContent', cardSelected ? 'card' : 'field');
  }

  @action
  updateCardId(id) {
    if (!this.args.updateCardId) {
      return;
    }

    this.args.updateCardId(id);
  }

  *outerTransition({ keptSprites }) {
    printSprites(arguments[0], 'outerTransition');
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
    });
  }

  *innerTransition({ insertedSprites, removedSprites }) {
    printSprites(arguments[0], 'innerTransition');
    insertedSprites.forEach(sprite => {
      fadeIn(sprite);
    });
    removedSprites.forEach(sprite => {
      fadeOut(sprite);
    });
  }
}
