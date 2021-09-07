import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked displayTools = true;
  @tracked isSelected = false;
}
