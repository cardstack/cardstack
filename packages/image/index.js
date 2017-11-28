/* eslint-env node */
'use strict';
const whenEnabled = require('@cardstack/plugin-utils/when-enabled');
module.exports = whenEnabled({
  name: '@cardstack/image',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
});
