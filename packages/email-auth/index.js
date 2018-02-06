/* eslint-env node */
'use strict';
const whenEnabled = require('@cardstack/plugin-utils/when-enabled');

module.exports = whenEnabled({
  name: '@cardstack/email-auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
});
