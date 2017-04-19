/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/github-auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
