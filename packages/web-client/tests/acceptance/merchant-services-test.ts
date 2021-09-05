import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

interface Context extends MirageTestContext {}

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

    // TODO
  });
});
