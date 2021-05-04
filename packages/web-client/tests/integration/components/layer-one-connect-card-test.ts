import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';

module('Integration | Component | layer-one-connect-card', function (hooks) {
  setupRenderingTest(hooks);

  test("It should render the wallet provider's name if provided at the start", async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    layer1Service.test__simulateAccountsChanged(['address'], 'metamask');

    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);

    assert
      .dom('[data-test-mainnet-connection-header]')
      .containsText('Metamask');
  });

  test('If should show a selection UI if layer 1 is not connected', async function (assert) {
    await render(hbs`
        <CardPay::LayerOneConnectCard/>
      `);

    assert
      .dom('[data-test-mainnet-connection-header]')
      .containsText('Connect your Ethereum mainnet wallet');

    assert.dom('[data-test-wallet-selection]').isVisible();
  });
});
