/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/ethereum',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
};
