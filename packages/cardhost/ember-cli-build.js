'use strict';

process.env.EMBROIDER_REBUILD_ADDONS = [
  process.env.EMBROIDER_REBUILD_ADDONS,
  '@cardstack/compiled',
  '@cardstack/base-cards',
  '@cardstack/boxel',
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
        module: {
          rules: [
            {
              test: /\.(png|jpg|gif|svg|woff|woff2|eot|ttf|otf|flac)$/i,
              loader: 'file-loader',
              options: {
                name: '[path][name]-[contenthash].[ext]',
              },
            },
          ],
        },
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
