const chai = require('chai');
chai.use(require('chai-things'));
chai.use(require('./collection-contains'));
chai.use(require('./has-status'));
chai.use(require('chai-as-promised'));

if (!process.__didSetCardstackWarning) {
  process.__didSetCardstackWarning = true;
  // Without this, we can't see stack traces for certain failures within
  // promises during the test suite.
  process.on('warning', (warning) => {
    /* eslint-disable no-console */
    console.warn(warning.stack);
    /* eslint-enable no-console */
  });
}

if (!process.env['PGSEARCH_NAMESPACE']) {
  // Avoid stomping on any existing content in elasticsearch by
  // namespacing the test indices differently.
  process.env['PGSEARCH_NAMESPACE'] = `test_${Date.now()}`;
}

// TODO - add back throwing an exception for unexpected logging of warns and errors
require('@cardstack/logger').configure({
  defaultLevel: 'warn'
});

module.exports = function() {
  global.expect = chai.expect;
};
