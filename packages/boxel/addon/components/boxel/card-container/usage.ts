import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked displayBoundaries = true;
  @tracked isHighlighted = false;
}
