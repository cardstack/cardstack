/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/core-types',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
