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
    this.route('adopt', { path: '/:id/adopt' });
    this.route('view', { path: '/:id' });
    this.route('edit', { path: '/:id/edit' });
    this.route('schema', { path: '/:id/schema' });
    this.route('themer', { path: '/:id/themer' });
  });
  this.route('ui-components');
});

export default Router;
