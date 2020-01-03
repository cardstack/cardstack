import Component from '@glimmer/component';
import { fieldComponents } from '@cardstack/core/utils/mappings';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import fade from 'ember-animated/transitions/fade';
import resize from 'ember-animated/motions/resize';
import { easeInAndOut } from 'ember-animated/easings/cosine';
import { remove } from 'lodash';

const duration = 250;

export default class RightEdge extends Component {
  @tracked cardName = this.args.card.name;
  @tracked cardSelected = this.args.cardSelected;
  @tracked options = {};
  @tracked expandedSections = ['template'];

  fade = fade;
  duration = duration;

  constructor(...args) {
    super(...args);

    if (this.args.updateCardId) {
      this.toggleSection('details');
    }
  }

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
