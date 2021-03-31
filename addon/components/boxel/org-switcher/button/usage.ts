import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import AMPLogo from '@cardstack/boxel/usage-support/images/orgs/amp-logo.png';

export default class extends Component {
  @tracked isSelected = false;
  org = {
    id: 'foo',
    iconURL: AMPLogo,
  };
}
