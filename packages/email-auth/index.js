/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/email-auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
