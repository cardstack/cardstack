'use strict';

module.exports = {
  extends: 'octane',
  rules: {
    'no-implicit-this': {
      allow: ['noop', 'placeholder-address'],
    },
    'no-curly-component-invocation': {
      allow: ['sentry-breadcrumb'],
    },
  },
};
