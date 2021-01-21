'use strict';

module.exports = {
  extends: 'octane',

  rules: {
    'no-curly-component-invocation': { allow: ['animated-orphans'] },
    'no-implicit-this': { allow: ['animated-orphans'] },
    'require-button-type': false,
  },
};
