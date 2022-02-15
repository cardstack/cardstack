'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const path = require('path');
const concat = require('broccoli-concat');
const webpack = require('webpack');
const svgoUniqueId = require('svgo-unique-id');

process.env.EMBROIDER_REBUILD_ADDONS = '@cardstack/boxel';

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
    'ember-power-select': { theme: false },
    svgJar: {
      strategy: 'inline',
      sourceDirs: ['public'],
      optimizer: {
        svgoModule: require('svgo'),
        plugins: [
          { removeTitle: false },
          { removeDesc: { removeAny: false } },
          { removeViewBox: false },
          {
            cleanupIDs: { minify: false },
          },
          {
            prefixIds: false,
          },
          {
            uniqueID: svgoUniqueId,
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
            vm: false,
          },
        },
        output: {
          assetModuleFilename: '[path][name]-[contenthash].[ext]',
        },
        module: {
          rules: [
            {
              test: /\.(png|jpg|gif|woff|woff2|eot|ttf|otf|flac)$/i,
              type: 'asset/resource',
            },
            {
              test: /\.svg$/i,
              type: 'asset/resource',
              use: [
                {
                  loader: '@hyperbola/svgo-loader',
                  options: {
                    plugins: [
                      { removeTitle: false },
                      { removeDesc: { removeAny: false } },
                      { removeViewBox: false },
                      {
                        cleanupIDs: { minify: false },
                      },
                      {
                        prefixIds: false,
                      },
                      {
                        uniqueID: svgoUniqueId,
                      },
                    ],
                  },
                },
              ],
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
        ignoreWarnings: [
          {
            /**
             * Typescript export not recognized as type
             */
            module: /node_modules\/ember-link\//,
            message:
              /export 'LinkParams' \(reexported as 'LinkParams'\) was not found in/,
          },
          {
            /**
             * Typescript export not recognized as type
             */
            module: /node_modules\/ember-link\//,
            message:
              /export 'UILinkParams' \(reexported as 'UILinkParams'\) was not found in/,
          },
          {
            /**
             * Helper that doesn't explicitly provide a named export
             */
            module: /helpers\/if-key/,
            message:
              /export 'ifKey' \(reexported as 'ifKey'\) was not found in/,
          },
          {
            /**
             * Helper that doesn't explicitly provide a named export
             */
            module: /helpers\/unique-id/,
            message:
              /export 'uniqueId' \(reexported as 'uniqueId'\) was not found in/,
          },
          {
            /**
             * ember-cli-mirage made a mistake here I think?
             * _DbCollection exists, but not _dbCollection
             */
            module: /node_modules\/ember-cli-mirage/,
            message:
              /export '_dbCollection' \(reexported as 'default'\) was not found in /,
          },
        ],
      },
    },
  });
};
