import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import {
  createDepotSafe,
  createSafeToken,
  generateMockAddress,
} from '@cardstack/web-client/utils/test-factories';

let layer2Service: Layer2TestWeb3Strategy;
let session: WorkflowSession;

module('Integration | Component | layer-two-connect-card', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    session = new WorkflowSession();

    this.setProperties({
      session,
    });
  });

  test('It should show nonzero token balances, and an appropriate message if there are none', async function (assert) {
    let depotAddress = generateMockAddress();
    layer2Service = this.owner.lookup('service:layer2-network').strategy;
    layer2Service.test__simulateRemoteAccountSafes('address', [
      createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI.CPXD', '2141100000000000000'),
          createSafeToken('CARD.CPXD', '0'),
        ],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged(['address']);

    await render(hbs`
      <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} />
    `);

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').doesNotExist();

    layer2Service.test__simulateRemoteAccountSafes('address', [
      createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI.CPXD', '2141100000000000000'),
          createSafeToken('CARD.CPXD', '2990000000000000000'),
        ],
      }),
    ]);
    await layer2Service.safes.fetch();
    await waitFor('[data-test-balance="CARD.CPXD"]');

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').containsText('2.99');

    layer2Service.test__simulateRemoteAccountSafes('address', [
      createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI.CPXD', '0'),
          createSafeToken('CARD.CPXD', '0'),
        ],
      }),
    ]);
    await layer2Service.safes.fetch();

    await waitUntil(() => {
      return (
        document.querySelector('[data-test-balance="DAI.CPXD"]') === null &&
        document.querySelector('[data-test-balance-container-loading]') === null
      );
    });

    assert.dom('[data-test-balance="DAI.CPXD"]').doesNotExist();
    assert.dom('[data-test-balance-container]').containsText('None');
  });

  test('the layer 2 wallet address is persisted if the wallet is already connected', async function (assert) {
    layer2Service = this.owner.lookup('service:layer2-network').strategy;
    layer2Service.test__simulateRemoteAccountSafes('address', [
      createDepotSafe({
        tokens: [
          createSafeToken('DAI.CPXD', '2141100000000000000'),
          createSafeToken('CARD.CPXD', '2990000000000000000'),
        ],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged(['address']);

    await render(hbs`
      <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} />
    `);
    assert.equal(session.getValue<string>('layer2WalletAddress'), 'address');
  });

  test('It should show a loading state if still fetching a depot', async function (assert) {
    layer2Service = this.owner.lookup('service:layer2-network').strategy;

    layer2Service.test__autoResolveViewSafes = false;
    layer2Service.test__simulateAccountsChanged(['address']);

    await render(hbs`
      <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} />
    `);

    assert.dom('[data-test-balance-container-loading]').isVisible();
  });

  test('the layer 2 wallet address is persisted after the wallet is connected', async function (assert) {
    layer2Service = this.owner.lookup('service:layer2-network').strategy;

    layer2Service.test__autoResolveViewSafes = false;
    layer2Service.test__simulateAccountsChanged(['address-connected']);

    await render(hbs`
      <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} />
    `);

    assert.equal(
      session.getValue<string>('layer2WalletAddress'),
      'address-connected'
    );
  });

  test('It shows the connect prompt by default', async function (assert) {
    await render(hbs`
        <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} />
      `);

    assert
      .dom('[data-test-layer-2-connect-prompt]')
      .containsText('Install the Card Wallet app on your mobile phone');
  });

  test('It does not show the connect prompt when workflow is completed and wallet is disconnected', async function (assert) {
    await render(hbs`
        <CardPay::LayerTwoConnectCard @workflowSession={{this.session}} @isComplete={{true}} />
      `);

    assert.dom('[data-test-layer-2-connect-prompt]').doesNotExist();
    assert.dom('[data-test-layer-2-wallet-disconnect-button]').doesNotExist();
    assert.dom('[data-test-layer-2-wallet-summary]').exists();
    assert
      .dom('[data-test-layer-2-wallet-connected-status]')
      .includesText('Disconnected');
  });
});
