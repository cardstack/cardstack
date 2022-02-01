import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked label = 'Account';
  @tracked value = 'Gary Walker';
  @tracked id = 'sample-field';
  @tracked vertical = false;
  @tracked smallLabel = false;
  @tracked address = '0x...1234';
  @tracked icon = 'card';
  @tracked tag = '';
}
