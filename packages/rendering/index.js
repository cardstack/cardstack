'use strict';

module.exports = {
  name: '@cardstack/rendering',

  included(app){
    this._super.included.apply(this, arguments);
    while (app.app) {
      app = app.app;
    }
    app.registry.add("htmlbars-ast-plugin", {
      name: "cardstack-transform",
      plugin: require("./lib/transform"),
      baseDir() { return __dirname; }
    });
  }
};
