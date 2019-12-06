'use strict';

module.exports = {
  name: '@cardstack/codegen',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
};
