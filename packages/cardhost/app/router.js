
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
    this.route('update', { path: '/:id'});
  });
});

export default Router;
