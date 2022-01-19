import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';
const CardstackLogoForQR = '../../../images/icons/cardstack-logo-opaque-bg.svg';

export default class CardPayMerchantPaymentRequestCard extends Component {
  cardstackLogoForQR = CardstackLogoForQR;
  testFlightLink = config.urls.testFlightLink;
}
