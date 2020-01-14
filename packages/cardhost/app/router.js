import EmberRouter from '@ember/routing/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL,
});

Router.map(function() {
  this.route('cards', function() {
    this.route('render');
    this.route('add', { path: '/new' });
    this.route('card', { path: '/:name' }, function() {
      this.route('adopt', { path: '/adopt' });
      this.route('view', { path: '' });
      this.route('edit', { path: '/edit' });
      this.route('schema', { path: '/schema' });
    });
  });
  this.route('ui-components');
});

export default Router;
