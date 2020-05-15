'use strict';

const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');

module.exports = function(defaults) {
  let app = new EmberAddon(defaults, {
    /*
      Leave jQuery out of this addon's own test suite & dummy app by default,
      so that the addon can be used in apps without jQuery. If you really need
      jQuery, it's safe to remove this line.
    */
    vendorFiles: { 'jquery.js': null, 'app-shims.js': null },

    // our dummy app always uses faker, even in production
    'ember-faker': { enabled: true },

    fingerprint: {
      extensions: ['js', 'css', 'map', 'png', 'jpg', 'gif', 'svg'],
      generateAssetMap: true,
      fingerprintAssetMap: true,
      prepend: '/boxel/',
      replaceExtensions: ['html', 'css', 'js', 'json'],
      enabled: (process.env.EMBER_ENV !== 'test')
    }

    // Add options here
  });

  /*
    This build file specifies the options for the dummy test app of this
    addon, located in `/tests/dummy`
    This build file does *not* influence how the addon or the app using it
    behave. You most likely want to be modifying `./index.js` or app's build file
  */

  return app.toTree();
};
