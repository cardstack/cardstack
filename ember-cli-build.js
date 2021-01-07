'use strict';

const { Webpack } = require('@embroider/webpack');
const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    /*
      Leave jQuery out of this addon's own test suite & dummy app by default,
      so that the addon can be used in apps without jQuery. If you really need
      jQuery, it's safe to remove this line.
    */
    vendorFiles: { 'jquery.js': null, 'app-shims.js': null },

    // our app always uses faker, even in production
    'ember-faker': { enabled: true },

    fingerprint: {
      extensions: ['js', 'css', 'map', 'png', 'jpg', 'gif', 'svg', 'flac'],
      generateAssetMap: true,
      fingerprintAssetMap: true,
      prepend: '/boxel/',
      replaceExtensions: ['html', 'css', 'js', 'json'],
      enabled: (process.env.EMBER_ENV !== 'test')
    },

    // Add options here
    'ember-power-select': { theme: false }
  });

  return require('@embroider/compat').compatBuild(app, Webpack, {
    // extraPublicTrees: [extraTreeHere]
    staticAddonTestSupportTrees: true,
    staticAddonTrees: true,
    // staticHelpers: true,
    // staticComponents: true,
    packagerOptions: {
    //    webpackConfig: { }
      publicAssetURL: '/boxel/'
    }
  });
};
