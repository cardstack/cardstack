import Component from '@glimmer/component';
import HaileyImage from '@cardstack/boxel/usage-support/images/workflow/participants/thumb/Haley-OConnell.jpg';
import HSHLogo from '@cardstack/boxel/usage-support/images/workflow/orgs/hsh-icon.png';
import HLCLogo from '@cardstack/boxel/usage-support/images/workflow/orgs/hlc-icon.png';
import { tracked } from '@glimmer/tracking';

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
