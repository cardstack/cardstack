import EmberRouter from '@ember/routing/router';
//@ts-ignore
import config from '@cardstack/cardhost/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function() {
  this.route('cards', { path: '/cards/:org' }, function() {
    this.route('collection', { path: '/collection/:collection' });
    this.route('add', { path: '/add' });
    this.route('card', { path: '/:id' }, function() {
      this.route('adopt');
      this.route('view', { path: '' }, function() {
        this.route('edit');
      });
      this.route('configure', function() {
        this.route('layout', function() {
          this.route('themer');
        });
        this.route('fields');
        this.route('preview');
      });
    });
  });
  this.route('ui-components');
});
