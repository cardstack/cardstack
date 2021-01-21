/* eslint-env node */
'use strict';

module.exports = function (/* deployTarget */) {
  let ENV = {
    build: {
      environment: 'production',
    },
  };
  return ENV;
};
