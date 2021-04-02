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

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    trees: {
      app: withSideWatch('app', { watching: ['../core', '../card-loader'] }),
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
      module: {
        rules: [
          {
            test: /\card.json$/i,
            loader: '@cardstack/card-loader',
            options: {
              realm: 'https://cardstack.com/base/models',
            },
          },
        ],
      },
    },
  });
};
