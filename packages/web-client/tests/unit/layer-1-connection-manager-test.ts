import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { ConnectionManager } from '@cardstack/web-client/utils/web3-strategies/layer-1-connection-manager';
import Web3 from 'web3';
import Sinon from 'sinon';

module('Unit | layer 1 connection manager', function (hooks) {
  setupTest(hooks);

  test('It should be able to be instantiated for Kovan and Sokol', async function (assert) {
    let sokolConnectionManager = new ConnectionManager('sokol');
    let kovanConnectionManager = new ConnectionManager('kovan');

    assert.ok(
      sokolConnectionManager,
      'Sokol connection manager is instantiated'
    );

    assert.ok(
      kovanConnectionManager,
      'Kovan connection manager is instantiated'
    );
  });

  test('It should not have a strategy, provider, or providerId at instantiation', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');

    assert.ok(
      !connectionManager.strategy,
      'There is no strategy at first instantiation'
    );
    assert.ok(
      !connectionManager.provider,
      'There is no provider at first instantiation'
    );
    assert.ok(
      !connectionManager.providerId,
      'There is no providerId at first instantiation'
    );
  });

  test('It should have a strategy, provider, and providerId after calling connect + call web3.setProvider', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: Sinon.spy(),
    };
    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(
      connectionManager.strategy,
      'There is a strategy after connecting'
    );
    assert.ok(
      connectionManager.provider,
      'There is a provider after connecting'
    );
    assert.ok(
      connectionManager.providerId,
      'There is a providerId after connecting'
    );

    assert.ok(
      web3.setProvider.calledWith(connectionManager.provider),
      'web3.setProvider was called with the connection manager provider'
    );
  });

  test('It should have a strategy, provider, and providerId after calling connect + call web3.setProvider', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: Sinon.spy(),
    };
    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(
      connectionManager.strategy,
      'There is a strategy after reconnecting'
    );
    assert.ok(
      connectionManager.provider,
      'There is a provider after reconnecting'
    );
    assert.ok(
      connectionManager.providerId,
      'There is a providerId after reconnecting'
    );

    assert.ok(
      web3.setProvider.calledWith(connectionManager.provider),
      'web3.setProvider was called with the connection manager provider'
    );
  });

  test('Its strategy, provider, and providerId should be cleared after calling reset', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: () => {},
    };
    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    assert.ok(
      connectionManager.strategy,
      'There is a strategy after connecting'
    );
    assert.ok(
      connectionManager.provider,
      'There is a provider after connecting'
    );
    assert.ok(
      connectionManager.providerId,
      'There is a providerId after connecting'
    );

    connectionManager.reset();

    assert.ok(!connectionManager.strategy, 'There is no strategy after reset');
    assert.ok(!connectionManager.provider, 'There is no provider after reset');
    assert.ok(
      !connectionManager.providerId,
      'There is no providerId after reset'
    );
  });

  test('It calls the cross-tab-connection callback upon connected messages, if not already connected', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');

    let onCrossTabConnection = Sinon.spy();
    connectionManager.on('cross-tab-connection', onCrossTabConnection);

    let message = {
      type: 'CONNECTED',
      session: 'SESSION',
    };

    connectionManager.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onCrossTabConnection.calledWith(message),
      'The cross-tab-connection callback was called with the sent message'
    );
  });

  test('It does not call the cross-tab-connection callback upon connected messages, if already connected', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: () => {},
    };

    let onCrossTabConnection = Sinon.spy();
    connectionManager.on('cross-tab-connection', onCrossTabConnection);

    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    let message = {
      type: 'CONNECTED',
      session: 'SESSION',
    };

    connectionManager.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onCrossTabConnection.notCalled,
      'The cross-tab-connection callback was not called'
    );
  });

  test('It calls the disconnect callback upon disconnected messages, if already connected', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: () => {},
    };

    let onDisconnect = Sinon.spy();
    connectionManager.on('disconnected', onDisconnect);

    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask

    let message = {
      type: 'DISCONNECTED',
    };

    connectionManager.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onDisconnect.calledOnce,
      'The disconnect callback was called upon receiving the message'
    );
  });

  test('It does not call the disconnect callback upon disconnected messages, if not connected', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');

    let onDisconnect = Sinon.spy();
    connectionManager.on('disconnected', onDisconnect);

    let message = {
      type: 'DISCONNECTED',
    };

    connectionManager.broadcastChannel.test__simulateMessageEvent(message);

    assert.ok(
      onDisconnect.notCalled,
      'The disconnect callback was not called upon receiving the message'
    );
  });

  test('The onConnect method of the layer 1 connection manager sets the providerId in storage', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: () => {},
    };

    let onDisconnect = Sinon.spy();
    connectionManager.on('disconnected', onDisconnect);

    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask
    connectionManager.onConnect(['some-account']);

    assert.equal(
      ConnectionManager.getProviderIdForChain(connectionManager.chainId),
      connectionManager.providerId,
      'Storage contains the connected provider id after connection'
    );
  });

  test('The onDisconnect method of the layer 1 connection manager removes the providerId from storage', async function (assert) {
    let connectionManager = new ConnectionManager('kovan');
    let web3 = {
      setProvider: () => {},
    };

    let onDisconnect = Sinon.spy();
    connectionManager.on('disconnected', onDisconnect);

    await connectionManager.connect((web3 as unknown) as Web3, 'metamask'); // the test strategy is hardcoded to metamask
    connectionManager.onConnect(['some-account']);

    assert.equal(
      ConnectionManager.getProviderIdForChain(connectionManager.chainId),
      connectionManager.providerId,
      'Storage contains the connected provider id after connection'
    );

    connectionManager.onDisconnect(false);

    assert.equal(
      ConnectionManager.getProviderIdForChain(connectionManager.chainId),
      null,
      'Storage does not contain a provider id for the given chain, after disconnection'
    );
  });
});
