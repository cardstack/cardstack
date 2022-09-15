import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class HeaderUsage extends Component {
  @tracked header = 'Header';
  @tracked noBackground = false;
  @tracked isHighlighted = false;
}
