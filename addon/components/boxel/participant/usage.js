import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import HaileyImage from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';
import HSHLogo from '@cardstack/boxel/usage-support/images/orgs/hsh-icon.png';
import HLCLogo from '@cardstack/boxel/usage-support/images/orgs/hlc-icon.png';

export default class ParticipantUsageComponent extends Component {
  HaileyImage = HaileyImage;
  HSHLogo = HSHLogo;
  HLCLogo = HLCLogo;
  @tracked title = 'Haley O’Connell';
  @tracked description = 'Writer';
  @tracked image = HaileyImage;
  @tracked iconSize = 30;
  @tracked iconOnly = false;
  @tracked hasLogo = false;
}
