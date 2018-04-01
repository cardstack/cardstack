'use strict';

module.exports = {
  name: '@cardstack/image',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
