/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';
const kebabCase = require('lodash/kebabCase');

module.exports = {
  description: 'Generate a boxel component',

  locals(options) {
    let { name } = options.entity;
    return {
      cssClassName: `boxel-${kebabCase(name).replace(/\//g, '-')}`,
    };
  },
};
