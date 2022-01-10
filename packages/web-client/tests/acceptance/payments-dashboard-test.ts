import { module, test } from 'qunit';
import { visit, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  createMerchantSafe,
  getFilenameFromDid,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

const EXAMPLE_DID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

function createMockMerchantSafe(
  eoaAddress: string,
  merchantSafeAddress: string
) {
  return createMerchantSafe({
    address: merchantSafeAddress,
    owners: [eoaAddress],
    infoDID: EXAMPLE_DID,
  });
}

module('Acceptance | payments dashboard', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Merchant cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/payments');

    assert.dom('[data-test-merchants-section]').doesNotExist();
  });

  test('Merchants are listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createMockMerchantSafe(
        layer2AccountAddress,
        '0x212619c6Ea074C053eF3f1e1eF81Ec8De6Eb6F33'
      ),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    this.server.create('merchant-info', {
      id: await getFilenameFromDid(EXAMPLE_DID),
      name: 'Mandello',
      slug: 'mandello1',
      did: EXAMPLE_DID,
      color: '#00ffcc',
      'text-color': '#000000',
      'owner-address': layer2AccountAddress,
    });

    await visit('/card-pay/payments');

    await waitFor('[data-test-merchants-section]');
    assert
      .dom('[data-test-merchants-section] [data-test-safe-balances]')
      .exists({ count: 1 });

    assert.dom('[data-test-safe-balances-title]').containsText('Mandello');
    assert
      .dom('[data-test-safe-balances-footer-business-id]')
      .containsText('mandello1');
    assert
      .dom('[data-test-safe-balances-footer-managers]')
      .containsText('1 Manager');
    assert.dom('[data-test-merchant-logo-background="#00ffcc"]').exists();
    assert.dom('[data-test-merchant-logo-text-color="#000000"]').exists();

    await percySnapshot(assert);
  });
});
