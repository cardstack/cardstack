'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const { Webpack } = require('@embroider/webpack');
const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');
const concat = require('broccoli-concat');
const path = require('path');

// const { maybeEmbroider } = require('@embroider/test-setup');
// return maybeEmbroider(app);

module.exports = function (defaults) {
  let app = new EmberAddon(defaults, {
    /*
      Leave jQuery out of this addon's own test suite & dummy app by default,
      so that the addon can be used in apps without jQuery. If you really need
      jQuery, it's safe to remove this line.
    */
    boxel: {
      preserveAddonUsageFiles: true,
      processColocatedAppCss: true,
    },
    vendorFiles: { 'jquery.js': null, 'app-shims.js': null },

    // Add options here
    'ember-power-select': { theme: false },
  });

  let dummyComponentStylesTree = concat(
    path.join(__dirname, 'tests/dummy/app/components'),
    {
      inputFiles: ['**/*.css'],
      outputFile: '/assets/dummy-components.css',
      sourceMapConfig: { enabled: true },
    }
  );

  return require('@embroider/compat').compatBuild(app, Webpack, {
    extraPublicTrees: [dummyComponentStylesTree],
    staticAddonTestSupportTrees: true,
    staticAddonTrees: true,
    // staticHelpers: true,
    // staticComponents: true,
    staticAppPaths: ['data'],
    packagerOptions: {
      publicAssetURL:
        process.env.DEPLOY_TARGET === 's3-preview' ||
        process.env.DEPLOY_TARGET === 'production'
          ? process.env.S3_PREVIEW_ASSET_BUCKET_ENDPOINT + '/'
          : undefined,
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
      },
      // publicAssetURL: '/boxel/'
    },
  });
};
