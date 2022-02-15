import Route from '@ember/routing/route';
import RouterService from '@ember/routing/router-service';
import { LocationService } from '../services/location';
import { inject as service } from '@ember/service';
import config from '@cardstack/ssr-web/config/environment';
import '@cardstack/ssr-web/css/variables.css';
import '@cardstack/ssr-web/css/card-space.css';

export default class ApplicationRoute extends Route {
  @service declare router: RouterService;
  @service declare location: LocationService;

  beforeModel() {
    // if we are on the card space domain, we should not allow
    // users to visit other routes besides index
    // some important functionality will be messed up
    // eg. layer 1 infura calls via WalletConnect

    // NOTE: there is a caveat to this. If the user uses a LinkTo from this page
    // that leads to, say, card-pay.wallet, this interception will not run
    // it may be better to create a base class for all routes that has this functionality
    if (this.location.hostname.endsWith(config.cardSpaceHostnameSuffix)) {
      this.router.replaceWith('index');
    }
  }
}
