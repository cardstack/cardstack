'use strict';

module.exports = {
  name: '@cardstack/search',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
};
