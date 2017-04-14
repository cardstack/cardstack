/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/authentication',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
