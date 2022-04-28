import EmberRouter from '@ember/routing/router';
import config from '@cardstack/web-client/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('card-drop', function () {
    this.route('already-claimed');
    this.route('success');
  });

  this.route('cardpay');
  this.route('cardpay', { path: 'cardpay/*' });
  this.route('card-pay', function () {
    this.route('wallet');
    this.route('payments');
    this.route('reward');
    this.route('deposit-withdrawal');
  });
  this.route('boom');
  this.route('not-found', { path: '/*path' });
});
