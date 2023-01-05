/* eslint-disable no-undef */
const FastBootAppServer = require('fastboot-app-server');
const fetch = require('node-fetch');
const Sentry = require('@sentry/node');

function healthCheckMiddleware(req, res, next) {
  let userAgent = req.get('user-agent') || '';
  let isHealthCheck = userAgent.includes('ELB-HealthChecker');

  if (isHealthCheck) {
    res.status(200).send('fastboot server is up and running');
  } else {
    next();
  }
}

Sentry.init({
  dsn: process.env.SSR_WEB_SERVER_SENTRY_DSN,
  environment: process.env.SSR_WEB_ENVIRONMENT ?? 'development',
  tracesSampleRate: 1.0,
});

let server = new FastBootAppServer({
  log: false,
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
      atob: function (str) {
        return Buffer.from(str, 'base64').toString('binary');
      },
      // polyfill fetch globally for nodejs environment
      fetch,
      URLSearchParams,
      NodeSentry: Sentry,
    });
  },
  // This should be false for Twitter/Linkedin according to https://github.com/ember-fastboot/ember-cli-fastboot/tree/master/packages/fastboot-app-server#twitter-and-linkedin
  chunkedResponse: false, // Optional - Opt-in to chunked transfer encoding, transferring the head, body and potential shoeboxes in separate chunks. Chunked transfer encoding should have a positive effect in particular when the app transfers a lot of data in the shoebox.

  beforeMiddleware: function (app) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(healthCheckMiddleware);

    let ignoreUrlPattern = /^\/(assets\/|images\/).*(\..*)/;

    let logger = function (req, res, next) {
      if (!ignoreUrlPattern.test(req.url)) {
        let fullUrl = req.get('host') + req.originalUrl;

        // This logger runs before FastBoot has a chance to update the response
        // So we can't log the status code here
        console.log(`${new Date().toISOString()}: ${req.method} ${fullUrl}`);
      }
      next();
    };

    app.use(logger);
  },

  // This middleware will only run if there is an error that is not handled within FastBoot
  // This means that we should not have regular/non-error middleware, eg. loggers here because they won't work
  afterMiddleware: function (app) {
    app.use(Sentry.Handlers.errorHandler());
  },
});

server.start();
