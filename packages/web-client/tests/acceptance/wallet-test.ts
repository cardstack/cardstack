import { module, test } from 'qunit';
import { settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  createPrepaidCardCustomization,
  createPrepaidCardSafe,
} from '@cardstack/web-client/utils/test-factories';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

interface Context extends MirageTestContext {}

module('Acceptance | wallet', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function (this: Context) {
    this.server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/wallet');

    assert.dom('[data-test-card-balances]').doesNotExist();
  });

  // eslint-disable-next-line qunit/require-expect
  test('Cards are listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service = (
      this.owner.lookup('service:layer2-network') as Layer2Network
    ).strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

    let { did, customization } = await createPrepaidCardCustomization({
      issuerName: 'jortleby',
      colorScheme: this.server.schema.first('prepaid-card-color-scheme'),
      pattern: this.server.schema.all('prepaid-card-pattern').models[4],
    });

    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createPrepaidCardSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        spendFaceValue: 2324,
        prepaidCardOwner: layer2AccountAddress,
        issuer: layer2AccountAddress,
        customizationDID: did,
        reloadable: false,
        transferrable: false,
      }),
    ]);

    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    this.server.create('prepaid-card-customization', customization);

    await visit('/card-pay/wallet');

    assert.dom('[data-test-prepaid-cards-count]').containsText('1');

    assert
      .dom('[data-test-card-balances]')
      .containsText('$23.24 USD')
      .containsText('0x1234...abcd');

    assert
      .dom('[data-test-prepaid-card-attributes]')
      .containsText('Non-reloadable')
      .containsText('Non-transferrable');

    await settled();

    assert.dom('[data-test-prepaid-card-issuer-name]').containsText('jortleby');
    assert
      .dom(
        `[data-test-prepaid-card-background="${prepaidCardColorSchemes[0].background}"][data-test-prepaid-card-pattern="${prepaidCardPatterns[4].patternUrl}"]`
      )
      .exists();

    let secondAddress = '0x1826000000000000000000000000000000000000';

    layer2Service.test__simulateRemoteAccountSafes(secondAddress, [
      createPrepaidCardSafe({
        address: '0x567800000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        spendFaceValue: 4648,
        prepaidCardOwner: layer2AccountAddress,
        issuer: layer2AccountAddress,
      }),
    ]);

    await layer2Service.test__simulateAccountsChanged([secondAddress]);

    await settled();

    assert
      .dom('[data-test-card-balances]')
      .containsText('$46.48 USD')
      .containsText('0x5678...abcd');

    await percySnapshot(assert);
  });
});
