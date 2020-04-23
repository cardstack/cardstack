import EmberRouter from '@ember/routing/router';
import config from './config/environment';

class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('movie-registry', function() {
    this.route('view', { path: '/:id' });
    this.route('edit', { path: '/:id/edit' });
  });
  this.route('catalog', function() {
    this.route('preview', { path: '/:model/preview' });
    this.route('events', function() {
      this.route('edit', { path: '/:id/edit' });
      this.route('schema', { path: '/:id/schema' });
    });
    this.route('events-v2', function() {
      this.route('edit', { path: '/:id/edit' });
      this.route('view', { path: '/:id' });
    });
  });
  this.route('tools', function() {
    this.route('edit', { path: '/:model/:id/edit' });
    this.route('preview', { path: '/:model/:id/preview' });
  });
  this.route('articles', { path: '/articles/:id' }, function() {
    this.route('edit');
  });
  this.route('events', function() {
    this.route('view', { path: '/:id' });
  });
  this.route('demo', function() {
    this.route('boxel-examples');
    this.route('cards');
    this.route('form-cards', function() {
      this.route('edit', { path: '/:id/edit' });
    });
    this.route('edit-card');
    this.route('field-types');
    this.route('animate-input');
    this.route('image-cards', function() {
      this.route('image-card', { path: '/:id' });
    });
    this.route('drag-drop');
    this.route('drag-drop-animation');
    this.route('tic-tac-toe');
    this.route('tic-tac-toe-enhanced');
    this.route('card-select')
  });
});

export default Router;
