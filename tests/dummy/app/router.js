import EmberRouter from '@ember/routing/router';
import config from './config/environment';

class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('catalog', function() {
    this.route('preview', { path: '/:model/preview' });
  });
  this.route('tools', function() {
    this.route('edit', { path: '/:model/:id/edit' });
    this.route('preview', { path: '/:model/:id/preview' });
  });
  this.route('articles', { path: '/articles/:id' }, function() {
    this.route('edit', { path: '/edit' });
  });
  this.route('events', { path: '/events/:id'});
});

export default Router;
