import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

interface Context extends MirageTestContext {}

module('Acceptance | wallet sidebar', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Sidebar is hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay');

    assert.dom('[data-test-wallet-sidebar]').doesNotExist();
  });

  test('Sidebar shows counts and summaries when wallet is connected', async function (this: Context, assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      {
        type: 'prepaid-card',

        address: '0x123400000000000000000000000000000000abcd',

        tokens: [],
        owners: [layer2AccountAddress],

        issuingToken: '0xTOKEN',
        spendFaceValue: 2324,
        prepaidCardOwner: layer2AccountAddress,
        hasBeenUsed: false,
        issuer: layer2AccountAddress,
        reloadable: false,
        transferrable: false,
      },
    ]);

    await visit('/card-pay');

    assert
      .dom('[data-test-wallet-sidebar]')
      .containsText('0x1826...6E44')
      .containsText('1 Card');
  });
});
