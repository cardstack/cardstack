/* eslint-env node */
'use strict';

const os = require('os');

module.exports = function(/* deployTarget */) {
  let ENV = {
    build: {
      environment: 'production'
    },
    git: {
      worktreePath: `${os.tmpdir()}/deploy-box`
    }
  };
  return ENV;
};
