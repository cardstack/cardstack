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
  treeForAddonTestSupport(tree) {
    const Funnel = require('broccoli-funnel');

    let namespacedTree = new Funnel(tree, {
      srcDir: '/',
      destDir: `/${this.moduleName()}`,
      annotation: `Addon#treeForTestSupport (${this.name})`,
    });

    return this.preprocessJs(namespacedTree, '/', this.name, {
      registry: this.registry,
    });
  }
};
