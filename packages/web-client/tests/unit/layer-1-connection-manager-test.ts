import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import {
  ConnectionManager,
  ConnectionManagerStrategyFactory,
  ConnectionStrategy,
} from '@cardstack/web-client/utils/web3-strategies/layer-1-connection-manager';
import Web3 from 'web3';
import Sinon from 'sinon';
import { Layer1NetworkSymbol } from '@cardstack/web-client/utils/web3-strategies/types';
import { WalletProviderId } from '@cardstack/web-client/utils/wallet-providers';

class TestStrategyFactory implements ConnectionManagerStrategyFactory {
  createStrategy(
    chainId: number,
    networkSymbol: Layer1NetworkSymbol,
    _providerId: WalletProviderId
  ) {
    return new TestConnectionStrategy({
      chainId,
      networkSymbol,
    });
  }
}

class TestConnectionStrategy extends ConnectionStrategy {
  providerId: WalletProviderId = 'metamask'; // does not actually follow the metamask connection strategy behaviour, but we need a valid wallet provider here for the sake of the ui

  async setup(_session?: any) {
    // set an arbitrary non-nullish value for purposes of the tests
    this.provider = 'PROVIDER';
  }
  async reconnect() {}
  async connect() {
    return true;
  }
  async disconnect() {}
}

module('Unit | layer 1 connection manager', function (hooks) {
  setupTest(hooks);
  let subject: ConnectionManager;

  hooks.beforeEach(async function () {
    subject = new ConnectionManager('kovan', new TestStrategyFactory());
  });

  test('It should not have a providerId at instantiation', async function (assert) {
    assert.notOk(subject.providerId, 'There is no providerId at instantiation');
  });

  test("It should have a providerId, and assign web3's provider after calling connect", async function (assert) {
    let web3 = {
      setProvider: Sinon.spy(),
    };
    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(subject.providerId, 'There is a providerId after connecting');

    assert.ok(
      web3.setProvider.calledWith(subject.provider),
      'web3.setProvider was called with the connection manager provider'
    );
  });

  test("It should have a providerId, and assign web3's provider after calling reconnect", async function (assert) {
    let web3 = {
      setProvider: Sinon.spy(),
    };
    await subject.reconnect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(subject.providerId, 'There is a providerId after reconnecting');

    assert.ok(
      web3.setProvider.calledWith(subject.provider),
      'web3.setProvider was called with the connection manager provider'
    );
  });

  test('Its providerId should be cleared after calling reset', async function (assert) {
    let web3 = {
      setProvider: () => {},
    };
    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(subject.providerId, 'There is a providerId after connecting');

    subject.reset();

    assert.notOk(subject.providerId, 'There is no providerId after reset');
  });

  test('It calls the cross-tab-connection callback upon connected messages, if not already connected', async function (assert) {
    let onCrossTabConnection = Sinon.spy();
    subject.on('cross-tab-connection', onCrossTabConnection);

    let message = {
      type: 'CONNECTED',
      session: 'SESSION',
    };

    subject.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onCrossTabConnection.calledWith(message),
      'The cross-tab-connection callback was called with the sent message'
    );
  });

  test('It does not call the cross-tab-connection callback upon connected messages, if already connected', async function (assert) {
    let web3 = {
      setProvider: () => {},
    };

    let onCrossTabConnection = Sinon.spy();
    subject.on('cross-tab-connection', onCrossTabConnection);

    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    let message = {
      type: 'CONNECTED',
      session: 'SESSION',
    };

    subject.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onCrossTabConnection.notCalled,
      'The cross-tab-connection callback was not called'
    );
  });

  test('It calls the disconnect callback upon disconnected messages, if already connected', async function (assert) {
    let web3 = {
      setProvider: () => {},
    };

    let onDisconnect = Sinon.spy();
    subject.on('disconnected', onDisconnect);

    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    let message = {
      type: 'DISCONNECTED',
    };

    subject.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onDisconnect.calledOnce,
      'The disconnect callback was called upon receiving the message'
    );
  });

  test('It does not call the disconnect callback upon disconnected messages, if not connected', async function (assert) {
    let onDisconnect = Sinon.spy();
    subject.on('disconnected', onDisconnect);

    let message = {
      type: 'DISCONNECTED',
    };

    subject.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onDisconnect.notCalled,
      'The disconnect callback was not called upon receiving the message'
    );
  });

  test('The onConnect method of the layer 1 connection manager sets the providerId in storage', async function (assert) {
    let web3 = {
      setProvider: () => {},
    };

    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask
    subject.onConnect(['some-account']);

    assert.equal(
      ConnectionManager.getProviderIdForChain(subject.chainId),
      subject.providerId,
      'Storage contains the connected provider id after connection'
    );
  });

  test('The onDisconnect method of the layer 1 connection manager removes the providerId from storage', async function (assert) {
    let web3 = {
      setProvider: () => {},
    };

    await subject.connect(web3 as unknown as Web3, 'metamask'); // the test strategy is hardcoded to metamask
    subject.onConnect(['some-account']);

    assert.equal(
      ConnectionManager.getProviderIdForChain(subject.chainId),
      subject.providerId,
      'Storage contains the connected provider id after connection'
    );

    subject.onDisconnect(false);

    assert.equal(
      ConnectionManager.getProviderIdForChain(subject.chainId),
      null,
      'Storage does not contain a provider id for the given chain, after disconnection'
    );
  });
});
