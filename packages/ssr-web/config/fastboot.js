const fetch = require('node-fetch');

module.exports = function (/* environment */) {
  return {
    buildSandboxGlobals(defaultGlobals) {
      return Object.assign({}, defaultGlobals, {
        btoa: function (str) {
          return Buffer.from(str).toString('base64');
        },
        // polyfill fetch globally for nodejs environment
        // has to be done here instead of assigning global.fetch
        // because the server runs the ember app within a sandbox
        fetch,
        URLSearchParams,
      });
    },
  };
};
