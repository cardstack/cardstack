'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');

module.exports = function (environment) {
  let ENV = {
    modulePrefix: '@cardstack/safe-tools-client',
    environment,
    rootURL: '/',
    locationType: 'history',
    exportApplicationGlobal: true,
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    },

    hubUrl: process.env.HUB_URL,
    version: pkg.version,
    sentryDsn: process.env.SENTRY_DSN,
    '@sentry/ember': {
      sentry: {
        dsn: process.env.SENTRY_DSN,
        enabled: process.env.SENTRY_DSN !== undefined,
        environment: process.env.DEPLOY_TARGET || 'development',
        release:
          `safe-tools-client${
            process.env.GITHUB_SHA ? `-${process.env.GITHUB_SHA}` : ''
          }@` + pkg.version,
        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production,
        tracesSampleRate: 1.0,
        maxValueLength: 2000, // Don't truncate long strings in error traces
      },
    },
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;

    ENV.hubUrl = ENV.hubUrl ?? 'http://localhost:3000';
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
    ENV.hubUrl = '/hub-test';
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
