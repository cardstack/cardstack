import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import hasStatus from './has-status';

chai.use(hasStatus);
chai.use(chaiAsPromised);

if (!(process as any).__didSetCardstackWarning) {
  (process as any).__didSetCardstackWarning = true;
  // Without this, we can't see stack traces for certain failures within
  // promises during the test suite.
  process.on('warning', (warning) => {
    /* eslint-disable no-console */
    console.warn(warning.stack);
    /* eslint-enable no-console */
  });
}

import logger from '@cardstack/logger';
logger.configure({
  defaultLevel: 'warn',
});

(global as any).expect = chai.expect;
