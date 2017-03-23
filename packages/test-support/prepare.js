let chai = require('chai');
global.expect = chai.expect;
chai.use(require('chai-things'));
chai.use(require('./collection-contains'));
chai.use(require('./has-status'));

// Without this, we can't see stack traces for certain failures within
// promises during the test suite.
process.on('warning', (warning) => {
  /* eslint-disable no-console */
  console.warn(warning.stack);
  /* eslint-enable no-console */
});

// Within our test suite, we default to showing warnings and
// higher for all loggers.
if (!process.env['DEBUG']) {
  process.env.DEBUG='*';
}
if (!process.env['DEBUG_LEVEL']) {
  process.env.DEBUG_LEVEL='warn';
}
