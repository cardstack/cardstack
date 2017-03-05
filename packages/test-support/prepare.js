let chai = require('chai');
global.expect = chai.expect;
chai.use(require('chai-things'));

// Without this, we can't see stack traces for certain failures within
// promises during the test suite.
process.on('warning', (warning) => {
  /* eslint-disable no-console */
  console.warn(warning.stack);
  /* eslint-enable no-console */
});
