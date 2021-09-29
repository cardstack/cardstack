import { module, test } from 'qunit';
import { visit, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { createMerchantSafe } from '../helpers/data';

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

module('Acceptance | merchant services dashboard', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Merchant cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/merchant-services');

    assert.dom('[data-test-merchants-section]').doesNotExist();
  });

  test('Merchants are listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      createMockMerchantSafe(
        layer2AccountAddress,
        '0x212619c6Ea074C053eF3f1e1eF81Ec8De6Eb6F33'
      ),
    ]);
    let resolver = new Resolver({ ...getResolver() });
    let resolvedDID = await resolver.resolve(EXAMPLE_DID);
    let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs![0]!;
    let customizationJsonFilename = didAlsoKnownAs.split('/')[4].split('.')[0];

    this.server.create('merchant-info', {
      id: customizationJsonFilename,
      name: 'Mandello',
      slug: 'mandello1',
      did: EXAMPLE_DID,
      color: '#00ffcc',
      'text-color': '#000000',
      'owner-address': layer2AccountAddress,
    });

    await visit('/card-pay/merchant-services');
    assert.dom('[data-test-merchants-section]').exists();
    await waitFor('[data-test-merchant-dashboard-card]');
    assert
      .dom('[data-test-merchants-section] [data-test-merchant-dashboard-card]')
      .exists({ count: 1 });
    assert.dom('[data-test-merchant="Mandello"]').exists();
    assert.dom('[data-test-merchant-logo-background="#00ffcc"]').exists();
    assert.dom('[data-test-merchant-logo-text-color="#000000"]').exists();
  });
});
