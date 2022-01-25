import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked label = 'Full Name of the Issuer';
  @tracked value = 'Gary Walker';
  @tracked id = 'sample-field';
  @tracked vertical = false;
  @tracked smallLabel = false;
}
