const chai = require('chai');
chai.use(require('chai-things'));
chai.use(require('./collection-contains'));
chai.use(require('./has-status'));

const defaultDebugChannels = 'cardstack/*';
const defaultDebugLevel = 'warn';

const { format } = require('util');

if (!process.__didSetCardstackWarning) {
  process.__didSetCardstackWarning = true;
  // Without this, we can't see stack traces for certain failures within
  // promises during the test suite.
  process.on('warning', (warning) => {
    /* eslint-disable no-console */
    console.warn(warning.stack);
    /* eslint-enable no-console */
  });

  // If the user isn't customizing anything about logging, we generate
  // log messages for warnings or higher, and we install a handler that
  // will cause any unexpected log message to fail the tests.
  if (!process.env['DEBUG']) {
    // these third-party deps have loud logging even at warn level
    process.env.DEBUG=defaultDebugChannels;
    if (!process.env['DEBUG_LEVEL']) {
      process.env.DEBUG_LEVEL = defaultDebugLevel;
    }
  }
}

if (!process.env['ELASTICSEARCH_PREFIX']) {
  // Avoid stomping on any existing content in elasticsearch by
  // namespacing the test indices differently.
  process.env['ELASTICSEARCH_PREFIX'] = `test_${Date.now()}`;
}

module.exports = function() {

  global.expect = chai.expect;

  if (process.env.DEBUG === defaultDebugChannels && process.env.DEBUG_LEVEL === defaultDebugLevel) {
    require('@cardstack/plugin-utils/logger');
    global.__cardstack_global_logger.print = function(namespace, logLine) {
      setTimeout(function() {
        throw new Error("Unexpected log message during tests: " + format(...logLine));
      }, 0);
    };
  }
};
