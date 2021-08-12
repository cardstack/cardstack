'use strict';

process.env.EMBROIDER_REBUILD_ADDONS = [
  process.env.EMBROIDER_REBUILD_ADDONS,
  '@cardstack/compiled',
  '@cardstack/base-cards',
  'ember-cli-mirage',
]
  .filter(Boolean)
  .join(',');

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');
const withSideWatch = require('./lib/with-side-watch');
const Funnel = require('broccoli-funnel');
const { ProvidePlugin } = require('webpack');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    trees: {
      app: withSideWatch('app', { watching: ['../core'] }),
    },
  });

  // Workaround to support mirage under embroider 0.39.1
  let trees = [];
  if (app.env !== 'production') {
    let mirage = new Funnel('mirage', {
      destDir: 'mirage',
    });
    trees.push(mirage);
  }

  return compatBuild(app, Webpack, {
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
    extraPublicTrees: trees,
  });
};
