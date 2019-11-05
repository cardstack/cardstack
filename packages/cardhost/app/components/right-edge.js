import Component from '@glimmer/component';
import { fieldComponents } from './card-manipulator';

export default class RightEdge extends Component {
  get sectionTitle() {
    let { title } = fieldComponents.findBy('coreType', this.args.selectedField.type);
    return title;
  }
}