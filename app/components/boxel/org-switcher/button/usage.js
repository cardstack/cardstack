import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { wmgLogo } from '../../../../data/organizations';

export default class extends Component {
  @tracked isSelected = false;
  wmgLogo = wmgLogo;
  org = {
    id: "foo",
    iconURL: this.wmgLogo
  }
}
