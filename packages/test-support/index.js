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
    let hub = this.addons.find(a => a.name === '@cardstack/hub');
    return hub.includedCommands();
  },
  serverMiddleware({ app }) {
    let hub = this.addons.find(a => a.name === '@cardstack/hub');
    return hub.serverMiddleware({ app });
  },
  testemMiddleware(app) {
    let hub = this.addons.find(a => a.name === '@cardstack/hub');
    return hub.testemMiddleware(app);
  }
};
