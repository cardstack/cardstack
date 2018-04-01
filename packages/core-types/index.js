'use strict';
const CssImport = require('postcss-import');
const CssNext = require('postcss-cssnext');

module.exports = {
  name: '@cardstack/core-types',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
  options: {
    postcssOptions: {
      compile: {
        enabled: true,
        plugins: [
          { module: CssImport },
          { module: CssNext }
        ]
      }
    }
  },

};
