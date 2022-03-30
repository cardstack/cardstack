import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CardPayLogo from '@cardstack/ssr-web/images/icons/card-pay-logo.svg';

export default class extends Component {
  @tracked hamburgerMenuOpen = false;
  cardPayLogo = CardPayLogo;
}
