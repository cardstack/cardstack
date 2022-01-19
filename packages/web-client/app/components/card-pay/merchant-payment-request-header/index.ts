import config from '@cardstack/web-client/config/environment';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
const CardPayLogo = '@cardstack/web-client/images/icons/card-pay-logo.svg';

export default class extends Component {
  @tracked hamburgerMenuOpen = false;
  cardPayLogo = CardPayLogo;
  supportURL = config.urls.discordSupportChannelUrl;
  aboutURL = config.urls.testFlightLink;
}
