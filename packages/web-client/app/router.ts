import EmberRouter from '@ember/routing/router';
import config from '@cardstack/web-client/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('card-pay', function () {
    this.route('balances');
    this.route('payments');
    this.route('reward-programs');
    this.route('deposit-withdrawal');
  });
  this.route('card-space', function () {
    this.route('profile-card-temp');
  });
  this.route('image-uploader-temp');
  this.route('pay', {
    path: '/pay/:network/:merchant_safe_id',
  });
  this.route('pay-missing-route', {
    path: '/pay/:*',
  });
  this.route('boom');
});
