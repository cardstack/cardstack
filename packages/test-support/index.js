const hub = require('@cardstack/plugin-utils/locate-hub');

module.exports = {
  name: '@cardstack/test-support',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
  included() {
    this._super.included.apply(this, arguments);
    this.import('vendor/dag-map-shim.js');
  },
  includedCommands() {
    return hub().includedCommands();
  },
  serverMiddleware({ app }) {
    return hub().serverMiddleware({ app });
  },
  testemMiddleware(app) {
    return hub().testemMiddleware(app);
  }
};
