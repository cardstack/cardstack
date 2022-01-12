import Web3SocketService from '../../services/web3-socket';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

describe('Web3Socket', function () {
  this.beforeEach(function () {
    Sentry.init({
      dsn: DUMMY_DSN,
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });

    testkit.reset();
  });

  it('reports to sentry when web3 initialization fails', async function () {
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

  it('reports error events', async function () {
    let web3Socket = new Web3SocketService();
    let web3 = web3Socket.getInstance();

    let provider: any = web3.currentProvider;
    provider.emit(provider.ERROR, new Error('A test error'));

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].error?.message).to.equal('A test error');
    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });

  it('reports close events', async function () {
    let web3Socket = new Web3SocketService();
    let web3 = web3Socket.getInstance();

    let provider: any = web3.currentProvider;
    provider.emit(provider.CLOSE, {
      code: 1006,
      reason: 'Testing',
      wasClean: false,
    });

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0]?.originalReport?.extra?.__serialized__).to.deep.equal({
      code: 1006,
      reason: 'Testing',
      wasClean: false,
    });
    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });
});
