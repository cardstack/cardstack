'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

module.exports = {
  name: require('./package').name,

  isDevelopingAddon() {
    return true;
  },
};
