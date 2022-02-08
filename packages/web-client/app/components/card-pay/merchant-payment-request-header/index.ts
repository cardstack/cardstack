import config from '@cardstack/web-client/config/environment';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import CardPayLogoPng from '@cardstack/web-client/images/logos/card-pay-logo.png';

export default class extends Component {
  @tracked hamburgerMenuOpen = false;
  cardPayLogo = CardPayLogo;
  cardPayLogoPng = 'https://' + config.universalLinkDomain + CardPayLogoPng;
}
