'use strict';

process.env.EMBROIDER_REBUILD_ADDONS = '@cardstack/boxel';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    // Add options here
  });

  return compatBuild(app, Webpack);
};
