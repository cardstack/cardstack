import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import BunnyLogo from '@cardstack/boxel/usage-support/images/orgs/bunny-logo.svg';

export default class extends Component {
  orgLogo = BunnyLogo;
  @tracked isSelected = false;
}
