import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import BN from 'bn.js';

module('Integration | Component | layer-two-connect-card', function (hooks) {
  setupRenderingTest(hooks);

  test('It should show nonzero token balances, and an appropriate message if there are none', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    await layer2Service.test__simulateAccountsChanged(['address']);
    await layer2Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      card: new BN('0'),
    });

    await render(hbs`
        <CardPay::LayerTwoConnectCard/>
      `);

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').doesNotExist();

    await layer2Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      card: new BN('2990000000000000000'),
    });

    await waitFor('[data-test-balance="CARD.CPXD"]');

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').containsText('2.99');

    await layer2Service.test__simulateBalances({
      defaultToken: new BN('0'),
      card: new BN('0'),
    });

    await waitUntil(() => {
      return document.querySelector('[data-test-balance="DAI.CPXD"]') === null;
    });

    assert.dom('[data-test-balance="DAI.CPXD"]').doesNotExist();
    assert.dom('[data-test-balance-container]').containsText('None');
  });

  test('It should show a loading state if still fetching a depot', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__autoResolveViewSafes = false;
    await layer2Service.test__simulateAccountsChanged(['address']);

    await render(hbs`
      <CardPay::LayerTwoConnectCard/>
    `);

    assert.dom('[data-test-balance-container-loading]').isVisible();
  });

  test('It shows the connect prompt by default', async function (assert) {
    await render(hbs`
        <CardPay::LayerTwoConnectCard />
      `);

    assert
      .dom('[data-test-layer-2-connect-prompt]')
      .containsText('Install the Card Wallet app on your mobile phone');
  });

  test('It does not show the connect prompt when workflow is completed and wallet is disconnected', async function (assert) {
    await render(hbs`
        <CardPay::LayerTwoConnectCard @isComplete={{true}} />
      `);

    assert.dom('[data-test-layer-2-connect-prompt]').doesNotExist();
    assert.dom('[data-test-layer-2-wallet-disconnect-button]').doesNotExist();
    assert.dom('[data-test-layer-2-wallet-summary]').exists();
    assert
      .dom('[data-test-layer-2-wallet-connected-status]')
      .includesText('Disconnected');
  });
});
