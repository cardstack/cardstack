'use strict';

const browsers = require('../package.json').browserslist;

// const isCI = Boolean(process.env.CI);
// const isProduction = process.env.EMBER_ENV === 'production';

module.exports = {
  browsers,
  node: 'current',
};
