const fetch = require('node-fetch');
const Sentry = require('@sentry/node');

// this file will not be run in prod environments.
// Sentry initialization for prod is in deployment/fastboot-server.js.
// leaving here for development use
// Sentry.init({
//   dsn: process.env.SSR_WEB_SERVER_SENTRY_DSN,
//   environment: process.env.SSR_WEB_ENVIRONMENT ?? 'development',
//   enabled: false,
//   tracesSampleRate: 1.0,
// });

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
        NodeSentry: Sentry,
      });
    },
  };
};
