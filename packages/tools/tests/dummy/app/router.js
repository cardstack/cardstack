import EmberRouter from '@ember/routing/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('posts', { path: '/' }, function() {
    this.route('new');
    this.route('show', { path: '/:id' });
  });
});

export default Router;
