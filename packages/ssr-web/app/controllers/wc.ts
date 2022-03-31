import Controller from '@ember/controller';
import config from '@cardstack/ssr-web/config/environment';
import CardstackLogo from '@cardstack/ssr-web/images/logos/cardstack-logo.jpg';

export default class WcController extends Controller {
  cardstackLogo = 'https://' + config.universalLinkDomain + CardstackLogo;
}
