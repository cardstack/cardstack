module.exports = {
  name: '@cardstack/test-support',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
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
