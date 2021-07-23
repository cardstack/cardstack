import { module, test } from 'qunit';
import { settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';
import { encodeDID, getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

module('Acceptance | card balances', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // TODO: fix typescript for mirage
    (this as any).server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Sidebar and cards are hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/balances');

    assert.dom('[data-test-balances-sidebar]').doesNotExist();
    assert.dom('[data-test-card-balances]').doesNotExist();
  });

  test('Sidebar shows and cards are listed when wallet is connected', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    let customizationDID = encodeDID({
      type: 'PrepaidCardCustomization',
      version: 10,
      uniqueId: 'BA44CC48-E0CB-463C-919F-0A78A64EDCC4',
    });

    let resolver = new Resolver({ ...getResolver() });
    let resolvedDID = await resolver.resolve(customizationDID);
    let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs[0]!;
    let customizationJsonFilename = didAlsoKnownAs.split('/')[4].split('.')[0];

    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      {
        type: 'prepaid-card',

        address: '0x123400000000000000000000000000000000abcd',

        tokens: [
          {
            tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
            balance: '1000000000000000000',
            token: {
              name: 'CARD Token Kovan.CPXD',
              symbol: 'CARD',
              decimals: 18,
            },
          },
          {
            tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
            balance: '998003992015968163',
            token: {
              name: 'Dai Stablecoin.CPXD',
              symbol: 'DAI',
              decimals: 18,
            },
          },
        ],
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

    this.server.create('prepaid-card-customization', {
      id: customizationJsonFilename,
      issuerName: 'jortleby',
      colorScheme: this.server.schema.prepaidCardColorSchemes.first(),
      pattern: this.server.schema.prepaidCardPatterns.all().models[4],
    });

    await visit('/card-pay/balances');

    assert.dom('[data-test-account-sidebar]').containsText('0x1826...6E44');

    assert.dom('[data-test-prepaid-cards-count]').containsText('1');

    assert
      .dom('[data-test-card-balances]')
      .containsText('§2324')
      .containsText('0x1234...abcd');

    assert.dom('[data-test-prepaid-card-non-reloadable]').exists();
    assert.dom('[data-test-prepaid-card-non-transferrable]').exists();

    await settled();

    assert.dom('[data-test-prepaid-card-issuer-name]').containsText('jortleby');
    assert
      .dom(
        `[data-test-prepaid-card-background="${prepaidCardColorSchemes[0].background}"][data-test-prepaid-card-pattern="${prepaidCardPatterns[4].patternUrl}"]`
      )
      .exists();
  });
});
