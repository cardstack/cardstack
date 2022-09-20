import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class RadioInputUsage extends Component {
  @tracked groupDescription = 'Select one';
  @tracked disabled = false;
}
