/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

process.env.EMBROIDER_REBUILD_ADDONS = '@cardstack/boxel';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { Webpack } = require('@embroider/webpack');
const { compatBuild } = require('@embroider/compat');
const svgoUniqueId = require('svgo-unique-id');

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

  return compatBuild(app, Webpack, {
    packagerOptions: {
      webpackConfig: {
        output: {
          assetModuleFilename: '[path][name]-[contenthash][ext]',
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
      },
    },
  });
};
