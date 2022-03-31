import Controller from '@ember/controller';
import config from '@cardstack/ssr-web/config/environment';
import CardPayLogoPng from '@cardstack/ssr-web/images/logos/card-pay-logo.png';

export default class WcController extends Controller {
  cardPayLogoPng = 'https://' + config.universalLinkDomain + CardPayLogoPng;
}
