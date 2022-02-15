'use strict';

// Note that the SDK (which holds these constants) is a TS lib, so we can't
// require it in this CJS file.
const MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME = 'wallet.cardstack.com';
const MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME =
  'wallet-staging.stack.cards';

const infuraIdsByTarget = {
  staging: '558ee533522a468e9d421d818e06fadb', // this infura id is specific to https://app-staging.stack.cards/
  production: '5d6efa6b750b45459184cd11dd2c8697', // this infura id is specific to https://app.cardstack.com/
};

const universalLinkHostnamesByTarget = {
  staging: MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
  production: MERCHANT_PAYMENT_UNIVERSAL_LINK_HOSTNAME,
};

const CARD_SPACE_HOSTNAME_LOCAL_DEV_SUFFIX = 'card.space.test';
const CARD_SPACE_HOSTNAME_SUFFIX = 'card.space';
const CARD_SPACE_HOSTNAME_STAGING_SUFFIX = 'pouty.pizza';
const CARD_SPACE_HOSTNAME_TEST_SUFFIX = 'space.example.com';

const cardSpaceHostnameSuffixesByTarget = {
  production: CARD_SPACE_HOSTNAME_SUFFIX,
  staging: CARD_SPACE_HOSTNAME_STAGING_SUFFIX,
  test: CARD_SPACE_HOSTNAME_TEST_SUFFIX,
};

const pkg = require('../package.json');

// eslint-disable-next-line no-undef
module.exports = function (environment) {
  let ENV = {
    modulePrefix: '@cardstack/ssr-web',
    environment,
    rootURL: '/',
    locationType: 'auto',
    hubURL: process.env.HUB_URL,
    universalLinkDomain:
      universalLinkHostnamesByTarget[process.env.DEPLOY_TARGET] ??
      MERCHANT_PAYMENT_UNIVERSAL_LINK_STAGING_HOSTNAME,
    cardSpaceHostnameSuffix:
      cardSpaceHostnameSuffixesByTarget[process.env.DEPLOY_TARGET] ??
      CARD_SPACE_HOSTNAME_LOCAL_DEV_SUFFIX,
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
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false,
      },
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    },
    chains: {
      layer1: process.env.DEPLOY_TARGET === 'production' ? 'eth' : 'keth',
      layer2: process.env.DEPLOY_TARGET === 'production' ? 'xdai' : 'sokol',
    },
    features: {
      createMerchant: true,
      enableCardSpace: process.env.DEPLOY_TARGET !== 'production',
      enableCardPay: true,
    },
    infuraId:
      infuraIdsByTarget[process.env.DEPLOY_TARGET] ?? process.env.INFURA_ID,
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
        (process.env.DEPLOY_TARGET === 'production'
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
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
