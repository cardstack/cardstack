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
    let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
    return title;
  }

  get didUpdate() {
    if (this.args.card && !this.args.card.isNew &&
      this.args.card.name !== this.cardName) {
      this.cardName = this.args.card.name;
    }
    return null;
  }

  @action
  updateCardId(id) {
    if (!this.args.updateCardId) { return; }

    this.args.updateCardId(id);
  }
}