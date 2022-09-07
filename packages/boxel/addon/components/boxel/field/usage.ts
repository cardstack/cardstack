import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked label = 'Full Name of the Issuer';
  @tracked value = 'Gary Walker';
  @tracked id = 'sample-field';
  @tracked vertical = false;
  @tracked centeredDisplay = false;
  @tracked horizontalLabelSize = 'default';
  @tracked icon = 'profile';
  @tracked tag = '';

  @tracked vertical2 = false;
  @tracked horizontalLabelSize2 = 'default';
  @tracked icon2 = '';

  @tracked labelSize = 'minmax(4rem, 25%)';
}
