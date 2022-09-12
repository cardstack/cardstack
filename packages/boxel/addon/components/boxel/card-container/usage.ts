import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class CardContainerUsage extends Component {
  @tracked displayBoundaries = true;
  @tracked isHighlighted = false;
}
