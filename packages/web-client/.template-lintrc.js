'use strict';

const Rule = require('ember-template-lint').Rule;
const config = require('./config/environment')('production');

// Adapted from https://stackoverflow.com/a/36490174
function paths(obj, parentKey) {
  var result;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    result = Object.keys(obj).flatMap((key) => {
      return paths(obj[key], key).map((subkey) => {
        return (parentKey ? parentKey + '.' : '') + subkey;
      });
    });
  } else {
    result = [];
  }
  return result.concat(parentKey || []);
}

let knownConfigKeys = paths(config);

class NoUnknownConfigKey extends Rule {
  visitor() {
    return {
      MustacheStatement(node) {
        validatePossibleConfigNode(this, node);
      },
      SubExpression(node) {
        validatePossibleConfigNode(this, node);
      },
    };
  }
}

function validatePossibleConfigNode(rule, node) {
  if (node.path.original === 'config') {
    let configKeyParam = node.params[0].value;

    if (!knownConfigKeys.includes(configKeyParam)) {
      rule.log({
        message: `The config helper was passed an unknown key: ${configKeyParam}`,
        node,
      });
    }
  }
}

module.exports = {
  extends: 'octane',
  plugins: [
    {
      name: 'unknown-config-inline-plugin',
      rules: {
        'no-unknown-config-key': NoUnknownConfigKey,
      },
    },
  ],
  rules: {
    'no-implicit-this': {
      allow: ['config', 'noop', 'placeholder-address'],
    },
    'no-curly-component-invocation': {
      allow: ['sentry-breadcrumb'],
    },
    'no-unknown-config-key': 'error',
  },
};
