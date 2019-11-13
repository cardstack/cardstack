import Component from '@glimmer/component';
import { fieldComponents } from './card-manipulator';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import fade from 'ember-animated/transitions/fade';
import resize from 'ember-animated/motions/resize';
import { fadeIn, fadeOut } from 'ember-animated/motions/opacity';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { printSprites } from 'ember-animated';

export default class RightEdge extends Component {
  fade = fade;
  @tracked cardName;
  @tracked displayCardMetadata;

  constructor(...args) {
    super(...args);

    if (this.args.card) {
      this.cardName = this.args.card.name;
    }

    this.displayCardMetadata = this.args.displayCardMetadata;
  }

  * outerTransition ({ keptSprites }) {
    printSprites(arguments[0], 'trayTransition');
    keptSprites.forEach(sprite => {
      resize(sprite, { easing: easeInAndOut });
    });
  }

  * innerTransition ({ insertedSprites, removedSprites }) {
    printSprites(arguments[0], 'trayTransition');
    insertedSprites.forEach(sprite => {
      fadeIn(sprite);
    });
    removedSprites.forEach(sprite => {
      fadeOut(sprite);
    });
  }

  get selectedFieldTitle() {
    if (this.args.selectedField) {
      let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
      return title;
    }

    return '';
  }

  @action
  updateCard(element, [card, displayCardMetadata]) {
    this.cardName = card.name;
    this.displayCardMetadata = displayCardMetadata;
  }

  @action
  updateCardId(id) {
    if (!this.args.updateCardId) { return; }

    this.args.updateCardId(id);
  }
}