'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

const getChannelURL = require('ember-source-channel-url');

module.exports = async function () {
  return {
    useYarn: true,
    scenarios: [
      {
        name: 'ember-lts-3.28',
        npm: {
          devDependencies: {
            'ember-source': '~3.28.5',
          },
        },
      },
      {
        name: 'ember-release',
        allowedToFail: true, // Allowed to fail until we handle ember-4 related deprecations
        npm: {
          devDependencies: {
            'ember-source': await getChannelURL('release'),
          },
        },
      },
      {
        name: 'ember-beta',
        allowedToFail: true,
        npm: {
          devDependencies: {
            'ember-source': await getChannelURL('beta'),
          },
        },
      },
    ],
  };
};
