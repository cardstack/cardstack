import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';
import CardstackLogoForQR from '../../../images/icons/cardstack-logo-opaque-bg.svg';

export default class CardPayMerchantPaymentRequestCard extends Component {
  canDeepLink = true;
  cardstackLogoForQR = CardstackLogoForQR;
  testFlightLink = config.urls.testFlightLink;
  paymentURL =
    'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
  merchant = {
    name: 'Happii Creations',
    logoBackground: 'cornflowerblue',
    logoTextColor: 'black',
  };
  amount = '300';
  usdAmount = '3';
}
