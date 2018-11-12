'use strict';

module.exports = {
  name: '@cardstack/data',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
};
