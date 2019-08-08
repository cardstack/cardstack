import EmberRouter from '@ember/routing/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('catalog', function() {
    this.route('preview', { path: '/:model/preview' });
    this.route('edit', { path: '/:model/edit' });
  });
  this.route('articles', { path: '/articles/:id'}, function() {
    this.route('preview', { path: '/preview' });
    this.route('edit', { path: '/edit' });
  });
  this.route('events', { path: '/events/:id'});
});

export default Router;
