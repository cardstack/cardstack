import EmberRouter from '@ember/routing/router';
import config from '@cardstack/ssr-web/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('pay', {
    path: '/pay/:network/:merchant_safe_id',
  });
  this.route('pay-missing-route', {
    path: '/pay/:*',
  });
  this.route('temp-auth');
  this.route('boom');
  this.route('boom-client');

  this.route('not-found', { path: '/*path' });
});
