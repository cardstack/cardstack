'use strict';

module.exports = {
  name: '@cardstack/models',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
