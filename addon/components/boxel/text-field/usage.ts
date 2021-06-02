import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked label = 'Full Name of the Issuer';
  @tracked value = 'Gary Walker';
  @tracked mode = 'edit';
  @tracked id = 'sample-field';
  @tracked labelClass = 'custom-classname';
  @tracked optional = false;
  @tracked invalid = false;
  @tracked errorMessage = '';
  @tracked helperText = '';
}
