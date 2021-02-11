'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {});

  return compatBuild(app, Webpack, {
    packagerOptions: {
      webpackConfig: {
        node: {
          fs: 'empty',
          path: true,
          process: true,
        },
      },
    },
  });
};
