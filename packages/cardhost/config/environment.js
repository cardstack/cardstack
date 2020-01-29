'use strict';

module.exports = function(environment) {
  let ENV = {
    modulePrefix: '@cardstack/cardhost',
    environment,
    rootURL: '/',
    locationType: 'auto',
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
        EMBER_NATIVE_DECORATOR_SUPPORT: true,
        EMBER_METAL_TRACKED_PROPERTIES: true,
        EMBER_GLIMMER_ANGLE_BRACKET_NESTED_LOOKUP: true,
        EMBER_GLIMMER_ANGLE_BRACKET_BUILT_INS: true,
        EMBER_GLIMMER_FN_HELPER: true,
        EMBER_GLIMMER_ON_MODIFIER: true,
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
    cardTemplates: JSON.parse(process.env.CARD_TEMPLATES || null) || [],
  };

  if (environment === 'development') {
    ENV['ember-a11y-testing'] = {
      componentOptions: {
        turnAuditOff: true, // set to "false" to see accessibility errors hightlighted in the browser. Even if there are no errors, this impacts performance and can lead to unexpected behavior, so it is recommended to only run the audit on-demand.
      },
    };
    // ENV.APP.LOG_RESOLVER = true;
    // ENV.APP.LOG_ACTIVE_GENERATION = true;
    // ENV.APP.LOG_TRANSITIONS = true;
    // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    // ENV.APP.LOG_VIEW_LOOKUPS = true;

    ENV.cardTemplates = JSON.parse(process.env.CARD_TEMPLATES || null) || [
      'local-hub::location-card',
      'local-hub::event-card',
      'local-hub::job-description',
      'local-hub::job-applicant-profile',
      'local-hub::event-ticket',
      'local-hub::product-card',
      'local-hub::wedding-invitation',
      'local-hub::photo-card',
      'local-hub::byline-card',
    ];
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;

    ENV.cardTemplates = JSON.parse(process.env.CARD_TEMPLATES || null) || ['local-hub::location-card'];

    ENV.animationSpeed = 20;
    ENV.autosaveDebounce = 10;
    ENV.autosaveDisabled = true;
    ENV['@cardstack/ui-components'] = {
      debounceSpeed: 10,
    };

    ENV.percy = {
      breakpointsConfig: {
        desktop: 1280,
      },
      defaultBreakpoints: ['desktop'],
    };
  }

  // if (environment === 'production') {

  // }

  return ENV;
};
