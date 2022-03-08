import config from '@cardstack/ssr-web/config/environment';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CardPayLogo from '@cardstack/ssr-web/images/icons/card-pay-logo.svg';
import CardPayLogoPng from '@cardstack/ssr-web/images/logos/card-pay-logo.png';

export default class extends Component {
  @tracked hamburgerMenuOpen = false;
  cardPayLogo = CardPayLogo;
  cardPayLogoPng = 'https://' + config.universalLinkDomain + CardPayLogoPng;
}
