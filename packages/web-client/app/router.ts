import EmberRouter from '@ember/routing/router';
import config from '@cardstack/web-client/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('card-pay', function () {
    this.route('balances');
    this.route('merchant-services');
    this.route('reward-programs');
    this.route('token-suppliers');
  });
});
