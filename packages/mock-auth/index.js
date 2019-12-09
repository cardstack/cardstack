'use strict';

module.exports = {
  name: '@cardstack/mock-auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
};
