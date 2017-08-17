module.exports = {
  name: '@cardstack/test-support',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },
  included() {
    this._super.included.apply(this, arguments);

    // after ember-cli 2.15 ships, we can un-vendor this and use the
    // direct node_modules import feature.
    this.import('vendor/dag-map.umd.js', { using: [
      { transformation: 'amd', as: 'dag-map' }
    ] });
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
