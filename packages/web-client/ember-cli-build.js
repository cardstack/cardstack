'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const path = require('path');
const concat = require('broccoli-concat');
const compileCSS = require('broccoli-postcss');
const postcss = require('postcss');
const webpack = require('webpack');

const prependSelector = postcss.plugin(
  'postcss-prepend-selector',
  function (opts) {
    opts = opts || {};
    return function (css) {
      css.walkRules(function (rule) {
        rule.selectors = rule.selectors.map(function (selector) {
          if (/(^|\b)(html|:root)\b/.test(selector)) {
            return selector;
          }
          // eslint-disable-next-line no-useless-escape
          if (/^([0-9]*[.])?[0-9]+\%$|^from$|^to$/.test(selector)) {
            // This is part of a keyframe
            return selector;
          }

          if (selector.startsWith(opts.selector.trim())) {
            return selector;
          }

          return opts.selector + selector;
        });
      });
    };
  }
);

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

  // prepend #web-client-root to all styles of web client's components
  // so that it has a bit more specificity and will take priority over Boxel's CSS
  // since Boxel's CSS is appearing after the DApp's in production
  let appComponentsStylesTree = new compileCSS(
    concat(path.join(__dirname, 'app/components'), {
      inputFiles: ['**/*.css'],
      outputFile: '/assets/app-components.css',
      sourceMapConfig: { enabled: true },
    }),
    {
      plugins: [
        prependSelector({
          selector: '#web-client-root ',
        }),
      ],
    }
  );

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
            {
              test: /\.css$/,
              include: [/web-client/],
              use: [
                {
                  loader: 'postcss-loader',
                  options: {
                    postcssOptions: {
                      plugins: [
                        prependSelector({
                          selector: '#web-client-root ',
                        }),
                      ],
                    },
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
      },
    },
  });
};
