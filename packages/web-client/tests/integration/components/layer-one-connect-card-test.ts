import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click, settled, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import BN from 'bn.js';

import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';

const HEADER_SELECTOR = '[data-test-action-card-title="layer-one-connect"]';
const CONNECT_BUTTON_SELECTOR = '[data-test-mainnet-connect-button]';
const DISCONNECT_BUTTON_SELECTOR = '[data-test-mainnet-disconnect-button]';
const WALLET_SELECTION_SELECTOR = '[data-test-wallet-selection]';

module('Integration | Component | layer-one-connect-card', function (hooks) {
  setupRenderingTest(hooks);

  test('It should show a selection UI if layer 1 is not connected', async function (assert) {
    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);

    assert
      .dom(HEADER_SELECTOR)
      .containsText(`Connect your ${c.layer1.fullName} wallet`);

    assert.dom(WALLET_SELECTION_SELECTOR).isVisible();
  });

  test('It should show card summary if card is completed and user disconnects the wallet', async function (assert) {
    await render(hbs`
        <CardPay::LayerOneConnectCard @isComplete={{true}}/>
      `);

    assert.dom('[data-test-layer-1-wallet-summary]').exists();
  });

  test("It should render the wallet provider's name if it is connected before rendering", async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');

    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);

    assert.dom(HEADER_SELECTOR).containsText('MetaMask');
  });

  test('It should show all nonzero token balances, and an appropriate message if there are none', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('500000000000000000'),
      card: new BN('10000000000000000000000'),
    });

    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);

    assert.dom('[data-test-balance="ETH"]').containsText('2.1411');
    assert.dom('[data-test-balance="DAI"]').containsText('0.50');
    assert.dom('[data-test-balance="CARD"]').containsText('10,000.00');

    layer1Service.test__simulateBalances({
      defaultToken: new BN('0'),
      dai: new BN('0'),
      card: new BN('10000000000000000000000'),
    });

    await waitUntil(() => {
      return document.querySelector('[data-test-balance="ETH"]') === null;
    });

    assert.dom('[data-test-balance="ETH"]').doesNotExist();
    assert.dom('[data-test-balance="DAI"]').doesNotExist();
    assert.dom('[data-test-balance="CARD"]').containsText('10,000.00');

    layer1Service.test__simulateBalances({
      defaultToken: new BN('0'),
      dai: new BN('0'),
      card: new BN('0'),
    });

    await waitUntil(() => {
      return document.querySelector('[data-test-balance="CARD"]') === null;
    });

    assert.dom('[data-test-balance="ETH"]').doesNotExist();
    assert.dom('[data-test-balance="DAI"]').doesNotExist();
    assert.dom('[data-test-balance="CARD"]').doesNotExist();

    assert.dom('[data-test-balance-container]').containsText('None');
  });

  test('It should be able to move between default (unconnected), loading, and connected states', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);
    await click('[data-test-wallet-option="metamask"]');
    await click(CONNECT_BUTTON_SELECTOR);

    // the card should not be assuming it is connected to metamask before connection is completed
    assert
      .dom('[data-test-boxel-action-chin-action-status-area]')
      .containsText('Waiting for you to connect');
    assert
      .dom(HEADER_SELECTOR)
      .containsText(`Connect your ${c.layer1.fullName} wallet`);

    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');
    // waiting for the downstream effects of resolving a promise in test__simulateAccountsChanged
    await settled();

    assert.dom(HEADER_SELECTOR).containsText('MetaMask');
    assert.dom(CONNECT_BUTTON_SELECTOR).doesNotExist();
    assert.dom(DISCONNECT_BUTTON_SELECTOR).isVisible();

    await click(DISCONNECT_BUTTON_SELECTOR);

    assert
      .dom(HEADER_SELECTOR)
      .containsText(`Connect your ${c.layer1.fullName} wallet`);
    assert.dom(CONNECT_BUTTON_SELECTOR).isVisible();
  });

  test('It should persist L1 address in workflow session if the wallet is already connected', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network').strategy;
    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');
    let session = new WorkflowSession();
    this.setProperties({ session });

    await render(hbs`
      <CardPay::LayerOneConnectCard @workflowSession={{this.session}} />
    `);

    assert.equal(session.getValue<string>('layer1WalletAddress'), 'address');
  });

  test('It should persist L1 address in workflow session after the wallet is connected', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network').strategy;
    let session = new WorkflowSession();
    this.setProperties({ session });

    await render(hbs`
      <CardPay::LayerOneConnectCard @workflowSession={{this.session}} />
    `);

    await click(CONNECT_BUTTON_SELECTOR);
    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');
    await settled();

    assert.equal(session.getValue<string>('layer1WalletAddress'), 'address');
  });
});
