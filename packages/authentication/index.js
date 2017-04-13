/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
