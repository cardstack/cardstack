import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { ampLogo } from '../../../../data/organizations';

export default class extends Component {
  @tracked isSelected = false;
  ampLogo = ampLogo;
  org = {
    id: 'foo',
    iconURL: this.ampLogo,
  };
}
