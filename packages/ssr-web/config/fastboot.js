const fetch = require('node-fetch');

module.exports = function (/* environment */) {
  return {
    buildSandboxGlobals(defaultGlobals) {
      return Object.assign({}, defaultGlobals, {
        btoa: function (str) {
          return Buffer.from(str).toString('base64');
        },
        fetch,
      });
    },
  };
};
