import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import ampLogo from 'dummy/images/media-registry/amp-logo.png';

export default class extends Component {
  @tracked isSelected = false;
  ampLogo = ampLogo;
}
