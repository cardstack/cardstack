'use strict';

module.exports = {
  name: '@cardstack/rendering',

  setupPreprocessorRegistry(type, registry) {
    // we register on our parent registry (so we will process code
    // from the app or addon that chose to include us) rather than our
    // own registry (which would cause us to process our own code)
    if (type !== 'parent') {
      return;
    }

    registry.add("htmlbars-ast-plugin", {
      name: "cardstack-transform",
      plugin: require("./lib/transform"),
      baseDir() { return __dirname; }
    });
  }
};
