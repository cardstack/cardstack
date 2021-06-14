import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toBN } from 'web3-utils';

module('Integration | Component | layer-two-connect-card', function (hooks) {
  setupRenderingTest(hooks);

  test('It should show nonzero token balances, and an appropriate message if there are none', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__simulateAccountsChanged(['address']);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'),
      card: toBN('0'),
    });

    await render(hbs`
        <CardPay::LayerTwoConnectCard/>
      `);

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').doesNotExist();

    layer2Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'),
      card: toBN('2990000000000000000'),
    });

    await waitFor('[data-test-balance="CARD.CPXD"]');

    assert.dom('[data-test-balance="DAI.CPXD"]').containsText('2.1411');
    assert.dom('[data-test-balance="CARD.CPXD"]').containsText('2.99');

    layer2Service.test__simulateBalances({
      defaultToken: toBN('0'),
      card: toBN('0'),
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

    layer2Service.test__simulateAccountsChanged(['address']);
    layer2Service.isFetchingDepot = true;

    await render(hbs`
      <CardPay::LayerTwoConnectCard/>
    `);

    assert.dom('[data-test-balance-container-loading]').isVisible();
  });
});
