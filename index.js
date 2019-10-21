'use strict';

module.exports = {
  name: '@cardstack/boxel',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
