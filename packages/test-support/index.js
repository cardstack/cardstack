module.exports = {
  name: '@cardstack/test-support',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  }
};
