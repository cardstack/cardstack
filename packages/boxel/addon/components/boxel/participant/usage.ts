import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import HaileyImage from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';

export default class ParticipantUsageComponent extends Component {
  @tracked title = 'Haley O’Connell';
  @tracked description = 'Writer';
  @tracked image = HaileyImage;
  @tracked iconSize: string | undefined;
  @tracked iconOnly = false;
  @tracked hasLogo = false;
}
