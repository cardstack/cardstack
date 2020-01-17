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
      this.route('adopt', { path: '/adopt' });
      this.route('view', { path: '' });
      this.route('edit', { path: '/edit' });
      this.route('schema', { path: '/schema' });
      this.route('themer', { path: '/themer' });
    });
  });
  this.route('ui-components');
});
