const chai = require('chai');
chai.use(require('chai-things'));
chai.use(require('./collection-contains'));
chai.use(require('./has-status'));

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

if (!process.env['ELASTICSEARCH_PREFIX']) {
  // Avoid stomping on any existing content in elasticsearch by
  // namespacing the test indices differently.
  process.env['ELASTICSEARCH_PREFIX'] = `test_${Date.now()}`;
}

// TODO - add back throwing an exception for unexpected logging of warns and errors

module.exports = function() {
  global.expect = chai.expect;
};
