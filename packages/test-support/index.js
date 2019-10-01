const hub = require('@cardstack/plugin-utils/locate-hub');
const Funnel = require('broccoli-funnel');

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

  treeForAddon() {
    let tree = this._super.apply(this, arguments);
    if (process.env.EMBER_ENV === 'test') {
      // Filter out the no-op environment.js file so that the codegen'ed
      // environment.js module will not collide with the no-op environment
      // needed to make embroider happy (since things pull on this module
      // from embroider's perspective regardless of the env).
      let filter = new Funnel(tree, {
        exclude: [' @cardstack/test-support/environment.js']
      });
      return filter;
    }
    return tree;
  },

  treeForAddonTestSupport(tree) {
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
