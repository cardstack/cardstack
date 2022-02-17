/* eslint-env node */

'use strict';

const path = require('path');

module.exports = function (env) {
  return {
    enabled: env === 'development',
    clientAllowedKeys: [],
    fastbootAllowedKeys: [],
    failOnMissingKey: false,
    path: path.join(path.dirname(__dirname), '.env'),
  };
};
