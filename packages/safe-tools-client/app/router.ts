import config from '@cardstack/safe-tools-client/config/environment';
import EmberRouter from '@ember/routing/router';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('pay');
  this.route('schedule');
  this.route('split');
});
