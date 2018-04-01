'use strict';

module.exports = {
  name: '@cardstack/mobiledoc',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
