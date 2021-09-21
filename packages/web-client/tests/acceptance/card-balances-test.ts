import { module, test } from 'qunit';
import { settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';
import { encodeDID, getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

interface Context extends MirageTestContext {}

module('Acceptance | card balances', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function (this: Context) {
    this.server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/balances');

    assert.dom('[data-test-card-balances]').doesNotExist();
  });

  test('Cards are listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    let customizationDID = encodeDID({
      type: 'PrepaidCardCustomization',
      version: 10,
      uniqueId: 'BA44CC48-E0CB-463C-919F-0A78A64EDCC4',
    });

    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      {
        type: 'prepaid-card',
        createdAt: Date.now() / 1000,

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
        customizationDID,
      },
    ]);

    let resolver = new Resolver({ ...getResolver() });
    let resolvedDID = await resolver.resolve(customizationDID);
    let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs![0]!;
    let customizationJsonFilename = didAlsoKnownAs.split('/')[4].split('.')[0];

    this.server.create('prepaid-card-customization', {
      id: customizationJsonFilename,
      issuerName: 'jortleby',
      colorScheme: this.server.schema.first('prepaid-card-color-scheme'),
      pattern: this.server.schema.all('prepaid-card-pattern').models[4],
    });

    await visit('/card-pay/balances');

    assert.dom('[data-test-prepaid-cards-count]').containsText('1');

    assert
      .dom('[data-test-card-balances]')
      .containsText('§2,324')
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

    layer2Service.test__simulateAccountSafes(secondAddress, [
      {
        type: 'prepaid-card',
        createdAt: Date.now() / 1000,

        address: '0x567800000000000000000000000000000000abcd',

        tokens: [],
        owners: [layer2AccountAddress],

        issuingToken: '0xTOKEN',
        spendFaceValue: 4648,
        prepaidCardOwner: layer2AccountAddress,
        hasBeenUsed: false,
        issuer: layer2AccountAddress,
        reloadable: false,
        transferrable: false,
      },
    ]);

    layer2Service.test__simulateAccountsChanged([secondAddress]);

    await settled();

    assert
      .dom('[data-test-card-balances]')
      .containsText('§4,648')
      .containsText('0x5678...abcd');
  });
});
