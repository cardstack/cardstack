'use strict';

module.exports = {
  name: '@cardstack/drupal-auth',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
