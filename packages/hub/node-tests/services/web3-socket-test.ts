import Web3SocketService from '../../services/web3-socket';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

describe('Web3Socket', function () {
  let subject: Web3SocketService;
  this.beforeAll(function () {
    Sentry.init({
      dsn: DUMMY_DSN,
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
  });
  this.beforeEach(function () {
    subject = new Web3SocketService();
    testkit.reset();
  });
  this.afterEach(async function () {
    let connection = (subject.web3?.currentProvider as unknown as any)?.connection;
    if (connection) {
      if (connection.readyState === connection.OPEN) connection.close(1000, 'Closing because test is done');
      // hack to make sure cleanup is properly done after tests
      // https://github.com/theturtle32/WebSocket-Node/issues/426
      connection._client.on('httpResponse', (r: any) => {
        r.destroy();
      });
      connection._client.on('connect', (c: any) => {
        c.close();
      });
    }
  });

  it('reports to sentry when web3 initialization fails', async function () {
    subject.initializeWeb3 = () => {
      throw new Error('mock web3 initialization failure');
    };

    expect(() => subject.getInstance()).to.throw('mock web3 initialization failure');

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });

  it('reports error events', async function () {
    let web3 = subject.getInstance();

    let provider: any = web3.currentProvider;
    provider.emit(provider.ERROR, new Error('A test error'));

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].error?.message).to.equal('A test error');
    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });

  it('reports close events', async function () {
    let web3 = subject.getInstance();

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
