import Component from '@glimmer/component';
import { fieldComponents } from './card-manipulator';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class RightEdge extends Component {
  @tracked cardName;

  constructor(...args) {
    super(...args);

    if (this.args.card) {
      this.cardName = this.args.card.name;
    }
  }

  get selectedFieldTitle() {
    if (this.args.selectedField) {
      let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
      return title;
    }

    return '';
  }

  @action
  updateCard(element, [card]) {
    this.cardName = card.name;
  }

  @action
  updateCardId(id) {
    if (!this.args.updateCardId) {
      return;
    }

    this.args.updateCardId(id);
  }
}
