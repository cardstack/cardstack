import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import wmgLogo from '@cardstack/boxel/images/media-registry/wmg-logo.svg';

export default class extends Component {
  @tracked isSelected = false;
  wmgLogo = wmgLogo;
}
