import EmberRouter from '@ember/routing/router';
import config from './config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('cards', function() {
    this.route('add', { path: '/add' });
    // using card-v2 to build out the app with the new data service. consolidate
    // back into the /cards/card route when ready
    this.route('card-v2', { path: '/v2/:id' }, function() {
      this.route('edit', function() {
        this.route('fields', function() {
          this.route('schema');
        });
      });
    });
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
    });
  });
  this.route('ui-components');
});
