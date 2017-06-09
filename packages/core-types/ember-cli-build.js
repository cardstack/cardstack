/* eslint-env node */
const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');
var CssImport = require('postcss-import');
var CssNext = require('postcss-cssnext');

module.exports = function(defaults) {
  var app = new EmberAddon(defaults, {
    postcssOptions: {
      compile: {
        enabled: true,
        plugins: [
          { module: CssImport },
          { module: CssNext }
        ]
      }
    }
  });

  /*
    This build file specifies the options for the dummy test app of this
    addon, located in `/tests/dummy`
    This build file does *not* influence how the addon or the app using it
    behave. You most likely want to be modifying `./index.js` or app's build file
  */

  return app.toTree();
};
