'use strict';

module.exports = {
  extends: 'recommended',

  rules: {
    'no-curly-component-invocation': {
      allow: ['animated-orphans', 'percent-complete'],
    },
    'no-implicit-this': { allow: ['animated-orphans', 'noop'] },
    'require-button-type': false,
    quotes: 'double',
  },

  ignore: ['tests/dummy/app/templates/media-registry/**'],
};
