/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';
const kebabCase = require('lodash/kebabCase');
const camelCase = require('lodash/camelCase');
const startCase = require('lodash/startCase');

module.exports = {
  description: 'Generate a boxel component',

  locals(options) {
    let { name } = options.entity;
    return {
      cssClassName: `boxel-${kebabCase(name).replace(/\//g, '-')}`,
      classComponentName: `Boxel::${startCase(camelCase(name)).replace(
        / /g,
        '::'
      )}`,
    };
  },
};
