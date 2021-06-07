import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class DropUsage extends Component {
  @tracked state = 'rest';
}
