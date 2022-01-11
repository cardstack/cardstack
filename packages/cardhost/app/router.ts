import EmberRouter from '@ember/routing/router';
import config from 'cardhost/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('playground');
  this.route('delegate', { path: '/*pathname' });
});
