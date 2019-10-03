
import EmberRouter from "@ember/routing/router";
import config from "./config/environment";

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('render');
  this.route('cards', function() {
    this.route('add', { path: '/new'});
    this.route('view', { path: '/:id'});
    this.route('edit', { path: '/:id/edit'});
    this.route('schema', { path: '/:id/schema'});
  });
});

export default Router;
