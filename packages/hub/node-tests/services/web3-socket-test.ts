import Web3SocketService from '../../services/web3-socket';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

// based on from https://github.com/TheBrainFamily/wait-for-expect/blob/master/src/index.ts
const waitForDefaults = {
  timeout: 1500,
  interval: 50,
};

function waitFor(
  expectation: () => boolean | Promise<boolean>,
  timeout = waitForDefaults.timeout,
  interval = waitForDefaults.interval
) {
  // eslint-disable-next-line no-param-reassign
  if (interval < 1) interval = 1;
  const maxTries = Math.ceil(timeout / interval);
  let tries = 0;
  return new Promise<void>((resolve, reject) => {
    async function rerun() {
      if (tries > maxTries) {
        reject(new Error(`Could not meet expectation within ${timeout}ms`));
      }
      // eslint-disable-next-line no-use-before-define
      setTimeout(runExpectation, interval);
    }
    async function runExpectation() {
      tries += 1;
      let v = await expectation();
      if (v) resolve();
      else rerun();
    }
    setTimeout(runExpectation, 0);
  });
}

describe('Web3Socket', function () {
  it('reports to sentry when web3 initialization fails', async function () {
    Sentry.init({
      dsn: DUMMY_DSN,
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
    let web3Socket = new Web3SocketService();

    web3Socket.initializeWeb3 = () => {
      throw new Error('mock web3 initialization failure');
    };

    expect(() => web3Socket.getInstance()).to.throw('mock web3 initialization failure');

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });
});
