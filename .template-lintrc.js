'use strict';

module.exports = {
  extends: 'octane',

  rules: {
    'no-curly-component-invocation': {
      allow: ['animated-orphans', 'percent-complete', 'in-left-toolbar'],
    },
    'no-implicit-this': { allow: ['animated-orphans', 'noop'] },
    'require-button-type': false,
    quotes: 'double',
  },
};
