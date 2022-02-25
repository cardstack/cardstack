const MultiReporter = require('testem-multi-reporter');
const TapReporter = require('testem/lib/reporters/tap_reporter');
const XunitReporter = require('testem/lib/reporters/xunit_reporter');
const fs = require('fs');
const path = require('path');

module.exports = function ciXmlReporting(config, filename) {
  if (!filename.endsWith('.xml')) {
    throw new Error(`Report file must have xml extension, instead received filename: ${filename}`);
  }
  if (!process.env.CI) return;
  const testResultPath = path.join(process.env.GITHUB_WORKSPACE, 'ci-xml-test-results');
  if (!fs.existsSync(testResultPath)) {
    throw new Error('XML test result path does not exist');
  }
  const reporters = [
    {
      ReporterClass: TapReporter,
      args: [false, null, { get: () => false }],
    },
    {
      ReporterClass: XunitReporter,
      args: [false, fs.createWriteStream(path.join(testResultPath, filename)), { get: () => false }],
    },
  ];

  const multiReporter = new MultiReporter({ reporters });

  config.reporter = multiReporter;
};
