'use strict';

module.exports = {
  name: '@cardstack/routing',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
