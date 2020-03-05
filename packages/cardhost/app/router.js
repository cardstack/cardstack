import EmberRouter from '@ember/routing/router';
import config from './config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('cards', function() {
    this.route('render');
    this.route('add', { path: '/new' });
    this.route('card', { path: '/:name' }, function() {
      this.route('adopt');
      this.route('view', { path: '' });
      this.route('edit', function() {
        this.route('layout', function() {
          this.route('themer');
        });
        this.route('fields', function() {
          this.route('schema');
        });
      });
      this.route('preview');
    });
  });
  this.route('ui-components');
});
