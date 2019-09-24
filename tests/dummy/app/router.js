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
  this.route('cards', function() {
    this.route('card', { path: '/:id' });
  });
  this.route('form-cards', function() {
    this.route('edit', { path: '/:id/edit' });
  });
  this.route('edit-demo');
  this.route('field-types-demo');
  this.route('animate-input');
  this.route('cards');
  this.route('image-cards', function() {
    this.route('image-card', { path: '/:id' });
  });
  this.route('drag-drop');
  this.route('drag-drop-animation');
});

export default Router;
