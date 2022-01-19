'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const path = require('path');
const concat = require('broccoli-concat');
const webpack = require('webpack');

process.env.EMBROIDER_REBUILD_ADDONS = '@cardstack/boxel';

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    'ember-power-select': { theme: false },
    svgJar: {
      optimizer: {
        plugins: [
          {
            cleanupIDs: false,
          },
        ],
      },
    },
  });

  app.import('node_modules/broadcastchannel-polyfill/index.js');

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  const { Webpack } = require('@embroider/webpack');

  let appComponentsStylesTree = concat(path.join(__dirname, 'app/components'), {
    inputFiles: ['**/*.css'],
    outputFile: '/assets/app-components.css',
    sourceMapConfig: { enabled: true },
  });

  // @ts-ignore
  if (typeof FastBoot !== 'undefined') {
    console.log('quee?');
    // @ts-ignore
    global.btoa = () => {};
  }

  return require('@embroider/compat').compatBuild(app, Webpack, {
    extraPublicTrees: [appComponentsStylesTree],
    packagerOptions: {
      webpackConfig: {
        devtool: 'source-map',
        resolve: {
          fallback: {
            stream: require.resolve('stream-browserify'),
            http: false,
            https: false,
            os: false,
            crypto: false,
          },
        },
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
        node: {
          global: true,
        },
        plugins: [
          new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
          }),
          new webpack.ProvidePlugin({
            process: 'process/browser',
          }),
        ],
      },
    },
  });
};
