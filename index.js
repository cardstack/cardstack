/* eslint-env node */

var CssImport = require('postcss-import');
var CssNext = require('postcss-cssnext');

'use strict';

module.exports = {
  name: 'cardstack-suite',
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
  }
};
