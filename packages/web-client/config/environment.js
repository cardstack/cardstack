'use strict';

// Note that the SDK (which holds these constants) is a TS lib, so we can't
// require it in this CJS file.
const PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
const PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME = 'wallet-staging.stack.cards';

const infuraIdsByTarget = {
  staging: '558ee533522a468e9d421d818e06fadb', // this infura id is specific to https://app-staging.stack.cards/
  production: '5d6efa6b750b45459184cd11dd2c8697', // this infura id is specific to https://app.cardstack.com/
};

const universalLinkHostnamesByTarget = {
  staging: PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
  production: PAYMENT_UNIVERSAL_LINK_HOSTNAME,
};

const pkg = require('../package.json');

// eslint-disable-next-line no-undef
module.exports = function (environment) {
  const deployTarget = process.env.DEPLOY_TARGET || '';
  let deployTargetClass = '';

  // Treat preview deployments (ex s3-preview-production) akin to main deployments
  if (deployTarget.endsWith('staging')) {
    deployTargetClass = 'staging';
  } else if (deployTarget.endsWith('production')) {
    deployTargetClass = 'production';
  }

  const deployTargetClassIsProduction = deployTargetClass === 'production';

  let ENV = {
    modulePrefix: '@cardstack/web-client',
    environment,
    rootURL: '/',
    locationType: 'history',
    exportApplicationGlobal: true,
    hubURL: process.env.HUB_URL,
    isIssuePrepaidCardEnabled: false,
    universalLinkDomain:
      universalLinkHostnamesByTarget[deployTargetClass] ??
      PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
    version: pkg.version,
    sentryDsn: process.env.SENTRY_DSN,
    '@sentry/ember': {
      sentry: {
        dsn: process.env.SENTRY_DSN,
        // debug: true, // uncomment this to get helpful logs about sentry's behavior
        enabled: !!process.env.DEPLOY_TARGET,
        environment: process.env.DEPLOY_TARGET || 'development',
        release:
          `web-client${
            process.env.GITHUB_SHA ? `-${process.env.GITHUB_SHA}` : ''
          }@` + pkg.version,
        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production,
        tracesSampleRate: 1.0,
      },
    },
    pageTitle: {
      separator: ' · ',
    },
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
    chains: {
      layer1: deployTargetClassIsProduction ? 'eth' : 'keth',
      layer2: deployTargetClassIsProduction ? 'gnosis' : 'sokol',
    },
    features: {},
    infuraId: infuraIdsByTarget[deployTargetClass] ?? process.env.INFURA_ID,
    urls: {
      about: 'https://cardstack.com/cardpay',
      appStoreLink:
        'https://apps.apple.com/us/app/card-wallet-by-cardstack/id1549183378',
      googlePlayLink:
        'https://play.google.com/store/apps/details?id=com.cardstack.cardpay',
      mailToSupportUrl: 'mailto:support@cardstack.com',
      statusPageBase: 'https://status.cardstack.com',
      statusPageUrl: 'https://status.cardstack.com/api/v2/summary.json',
    },
    // basically our favicons for now
    walletConnectIcons: [
      '/images/icon-apple-256x256.png',
      '/images/icon-favicon-32x32.png',
    ].map((v) => {
      return (
        (deployTargetClassIsProduction
          ? 'https://app.cardstack.com'
          : 'https://app-staging.stack.cards') + v
      );
    }),
    threadAnimationInterval: 1000,
    'ember-cli-mirage': {
      enabled: false,
    },
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;
    ENV.hubURL = ENV.hubURL ?? 'http://localhost:3000';
    ENV.threadAnimationInterval =
      process.env.THREAD_ANIMATION_INTERVAL ?? ENV.threadAnimationInterval;
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';
    ENV.chains.layer1 = 'test';
    ENV.chains.layer2 = 'test';

    // thread animation interval > 0 means we might have to wait for css animations in tests
    ENV.threadAnimationInterval = 0;

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;

    // mock server during test
    ENV.hubURL = '';
    ENV['ember-cli-mirage'] = {
      enabled: true,
      trackRequests: true,
    };

    ENV.isIssuePrepaidCardEnabled = true;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
