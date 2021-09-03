'use strict';

process.env.EMBROIDER_REBUILD_ADDONS = [
  process.env.EMBROIDER_REBUILD_ADDONS,
  '@cardstack/compiled',
  '@cardstack/base-cards',
]
  .filter(Boolean)
  .join(',');

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');
const withSideWatch = require('./lib/with-side-watch');
const { ProvidePlugin } = require('webpack');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    trees: {
      app: withSideWatch('app', { watching: ['../core'] }),
    },
  });

  return compatBuild(app, Webpack, {
    staticAppPaths: ['lib'],
    packagerOptions: {
      webpackConfig: {
        plugins: [
          new ProvidePlugin({
            Buffer: 'buffer',
            process: 'process',
          }),
        ],
        node: {
          global: true,
        },
        resolve: {
          fallback: {
            path: require.resolve('path-browserify'),
            process: require.resolve('process/'),
            fs: false,
          },
        },
      },
    },
  });
};
