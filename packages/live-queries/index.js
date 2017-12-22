/* eslint-env node */
'use strict';

module.exports = {
  name: '@cardstack/live-queries',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },

  included(app) {
    this._super.apply(this, arguments);

    let socketIoPath = require.resolve('socket.io-client/dist/socket.io.js');

    app.import(socketIoPath);
    app.import("vendor/socket-io-shim.js");
  }
};
