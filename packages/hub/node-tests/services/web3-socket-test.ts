import Web3SocketService from '../../services/web3-socket';
import { setupSentry, waitForSentryReport, waitForSentryReports } from '../helpers/sentry';
import { server as WebsocketServer } from 'websocket';
import http from 'http';

describe('Web3Socket', function () {
  let subject: Web3SocketService;
  let wsServer: WebsocketServer;
  let httpServer: http.Server;

  setupSentry(this);

  this.beforeEach(function () {
    httpServer = http.createServer(function (_, response) {
      response.end();
    });
    httpServer.listen(8545);
    wsServer = new WebsocketServer({
      httpServer,
      autoAcceptConnections: true,
    });
    wsServer.on('request', function (request: any) {
      request.accept('echo-protocol', request.origin);
    });
    subject = new Web3SocketService();
    subject.rpcURL = 'ws://localhost:8545';
  });
  this.afterEach(async function () {
    (subject.web3?.currentProvider as any)?.disconnect?.();
    wsServer.shutDown();
    httpServer.close();
  });

  it('reports to sentry when web3 initialization fails', async function () {
    subject.initializeWeb3 = () => {
      throw new Error('mock web3 initialization failure');
    };

    expect(() => subject.getInstance()).to.throw('mock web3 initialization failure');

    expect((await waitForSentryReport()).tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });

  it('reports error events', async function () {
    let web3 = subject.getInstance();

    let provider: any = web3.currentProvider;
    // we explicitly wait for the provider to be connected
    // to avoid trying to disconnect from a connecting state at the
    // end of this test
    await new Promise<void>((resolve) => {
      provider.on('connect', function () {
        resolve();
      });
      if (provider.connected) resolve();
    });
    provider.emit(provider.ERROR, new Error('A test error'));

    let sentryReport = await waitForSentryReport();
    expect(sentryReport.error?.message).to.equal('A test error');
    expect(sentryReport.tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });

  it('reports close events', async function () {
    let web3 = subject.getInstance();

    let provider: any = web3.currentProvider;
    // we explicitly wait for the provider to be connected
    // to avoid trying to disconnect from a connecting state at the
    // end of this test
    await new Promise<void>((resolve) => {
      provider.on('connect', function () {
        resolve();
      });
      if (provider.connected) resolve();
    });
    provider.emit(provider.CLOSE, {
      code: 1000,
      reason: 'Testing',
      wasClean: false,
    });

    let sentryReports = await waitForSentryReports(150000);

    let testCaseReport = sentryReports.find(
      (v) => (v?.originalReport?.extra?.__serialized__ as any).reason === 'Testing'
    )!;
    expect(testCaseReport?.extra?.__serialized__).to.deep.equal({
      code: 1000,
      reason: 'Testing',
      wasClean: false,
    });
    expect(testCaseReport.tags).to.deep.equal({
      action: 'web3-socket-connection',
    });
  });
});
