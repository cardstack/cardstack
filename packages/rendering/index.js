/* eslint-env node */
'use strict';
const whenEnabled = require('@cardstack/plugin-utils/when-enabled');
module.exports = whenEnabled({
  name: '@cardstack/rendering',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
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
});
