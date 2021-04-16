import { module, test } from 'qunit';
import {
  click,
  currentURL,
  visit,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | Connect Wallet', function (hooks) {
  setupApplicationTest(hooks);

  test('Connecting a layer 2 wallet via Cardstack Mobile', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay');

    await click(
      '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
    );
    let layer2Service = this.owner.lookup('service:layer2-network');
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-layer-two-connect-modal]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x18261...6E44');
    assert.dom('[data-test-wallet-connect-qr-code]').doesNotExist();
    assert.dom('[data-test-layer-two-connect-modal]').doesNotExist();
  });

  // TODO: Connecting a layer 2 wallet via alternate wallet
  // TODO: Connecting a layer 1 wallet
});
