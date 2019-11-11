import Component from '@glimmer/component';
import { fieldComponents } from './card-manipulator';
import { tracked } from '@glimmer/tracking';

export default class RightEdge extends Component {
  @tracked card;

  constructor(...args) {
    super(...args);

    this.card = this.args.card;
  }

  get sectionTitle() {
    if (this.args.selectedField) {
      let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
      return title;
    }

    return this.card.id;
  }
}