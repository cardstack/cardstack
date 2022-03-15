/* eslint-disable no-undef */
const FastBootAppServer = require('fastboot-app-server');
const fetch = require('node-fetch');
const Sentry = require('@sentry/node');

function healthCheckMiddleware(req, res, next) {
  let isHealthCheck = req.get('user-agent').includes('ELB-HealthChecker');
  if (isHealthCheck) {
    console.log(
      'intercepting request because it is a health check, host:',
      req.get('host'),
      ', user-agent:',
      req.get('user-agent')
    );
    res.status(200).send('fastboot server is up and running');
  } else {
    console.log(
      `not health check, proceeding. host: ${req.get(
        'host'
      )}, user-agent: ${req.get('user-agent')}`
    );
    next();
  }
}

Sentry.init({
  dsn: process.env.SSR_WEB_SERVER_SENTRY_DSN,
  environment: process.env.SSR_WEB_ENVIRONMENT,
});

let server = new FastBootAppServer({
  distPath: 'dist',
  gzip: true, // Optional - Enables gzip compression.
  host: '0.0.0.0', // Optional - Sets the host the server listens on.
  port: 4000, // Optional - Sets the port the server listens on (defaults to the PORT env var or 3000).
  buildSandboxGlobals(defaultGlobals) {
    // Optional - Make values available to the Ember app running in the FastBoot server, e.g. "MY_GLOBAL" will be available as "GLOBAL_VALUE"
    return Object.assign({}, defaultGlobals, {
      btoa: function (str) {
        return Buffer.from(str).toString('base64');
      },
      fetch,
    });
  },
  // This should be false for Twitter/Linkedin according to https://github.com/ember-fastboot/ember-cli-fastboot/tree/master/packages/fastboot-app-server#twitter-and-linkedin
  chunkedResponse: false, // Optional - Opt-in to chunked transfer encoding, transferring the head, body and potential shoeboxes in separate chunks. Chunked transfer encoding should have a positive effect in particular when the app transfers a lot of data in the shoebox.

  beforeMiddleware: function (app) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(healthCheckMiddleware);
  },

  afterMiddleware: function (app) {
    app.use(Sentry.Handlers.errorHandler());
  },
});

server.start();
