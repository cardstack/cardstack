'use strict';

module.exports = {
  name: '@cardstack/live-queries',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },

  included(app) {
    this._super.apply(this, arguments);

    app.import('node_modules/socket.io-client/dist/socket.io.js', {
      using: [
        {
          transformation: 'amd',
          as: 'socket-io',
        },
      ],
    });
  },
};
