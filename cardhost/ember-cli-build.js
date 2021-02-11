'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');
const withSideWatch = require('./lib/with-side-watch');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    trees: {
      app: withSideWatch('app', { watching: ['../core'] }),
    },
  });

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
