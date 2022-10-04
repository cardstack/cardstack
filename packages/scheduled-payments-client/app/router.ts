import EmberRouter from '@ember/routing/router';
import config from '@cardstack/scheduled-payments-client/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('edit');
});
