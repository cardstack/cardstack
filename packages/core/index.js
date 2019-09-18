'use strict';

module.exports = {
  name: require('./package').name,
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
