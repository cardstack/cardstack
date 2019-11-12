import Component from '@glimmer/component';
import { fieldComponents } from './card-manipulator';
import { tracked } from '@glimmer/tracking';

export default class RightEdge extends Component {
  @tracked card;
  @tracked cardName;

  constructor(...args) {
    super(...args);

    if (this.args.card) {
      this.card = this.args.card;
      this.cardName = this.args.card.name;
    }
  }

  get sectionTitle() {
    if (this.args.selectedField) {
      let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
      return title;
    }

    return this.card.id;
  }
}