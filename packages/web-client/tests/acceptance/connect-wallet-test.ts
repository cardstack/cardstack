import { module, test } from 'qunit';
import {
  click,
  currentURL,
  visit,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { setupMirage } from 'ember-cli-mirage/test-support';

module('Acceptance | Connect Wallet', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Connecting a layer 1 wallet via Metamask', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay/wallet');

    await click(
      '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
    );
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    await click('[data-test-wallet-option="metamask"]');
    await click(
      '[data-test-mainnnet-connection-action-container] [data-test-boxel-button]'
    );

    // Simulate the user connecting their Metamask wallet
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    await waitUntil(
      () => !document.querySelector('[data-test-layer-connect-modal="layer1"]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0xaCD5...4Fb6');
    assert.dom('[data-test-layer-connect-modal="layer1"]').doesNotExist();
  });

  test('Connecting a layer 2 wallet via Card Wallet mobile app', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay/wallet');

    await click(
      '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
    );

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    await a11yAudit();
    assert.ok(true, 'no a11y errors found on layer 2 connect modal');

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-layer-connect-modal="layer2"]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');
    assert.dom('[data-test-wallet-connect-qr-code]').doesNotExist();
    assert.dom('[data-test-layer-connect-modal="layer2"]').doesNotExist();

    await percySnapshot(assert);
  });

  // TODO: Connecting a layer 2 wallet via alternate wallet
  // TODO: Connecting a layer 1 wallet
});
