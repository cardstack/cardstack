import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled, setupOnerror } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

import { Safe } from '@cardstack/cardpay-sdk';
import {
  createDepotSafe,
  createMerchantSafe,
  createPrepaidCardSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/web-client/utils/test-factories';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TinyColor } from '@ctrl/tinycolor';

interface Context extends MirageTestContext {}

const EXAMPLE_DID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

module('Integration | Component | card-pay/safe-balances', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);

  let layer2Service: Layer2TestWeb3Strategy;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
  let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';
  let prepaidCardAddress = '0xprepaidDbAB0644ffCD32518eBF4924ba8666666';

  let depotSafe: Safe, merchantSafe: Safe, prepaidCardSafe: Safe;

  hooks.beforeEach(async function (this: Context) {
    this.server.create('merchant-info', {
      id: await getFilenameFromDid(EXAMPLE_DID),
      name: 'Mandello',
      slug: 'mandello1',
      did: EXAMPLE_DID,
      color: '#00ffcc',
      'text-color': '#000000',
      'owner-address': layer2AccountAddress,
    });

    layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      (depotSafe = createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI.CPXD', '250111100000000000000'),
          createSafeToken('CARD.CPXD', '500000000000000000000'),
        ],
      })),
      (merchantSafe = createMerchantSafe({
        address: merchantAddress,
        merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        tokens: [createSafeToken('DAI.CPXD', '125000000000000000000')],
        accumulatedSpendValue: 100,
        infoDID: EXAMPLE_DID,
      })),
      (prepaidCardSafe = createPrepaidCardSafe({
        address: prepaidCardAddress,
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '225000000000000000000'),
          createSafeToken('CARD.CPXD', '0'),
        ],
        spendFaceValue: 2324,
        prepaidCardOwner: layer2AccountAddress,
        issuer: layer2AccountAddress,
        transferrable: false,
      })),
    ]);

    // Ensure safes have been loaded, as in a workflow context
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
  });

  test('it renders a depot safe', async function (this: Context, assert) {
    this.set('safe', depotSafe);
    await render(hbs`
      <CardPay::SafeBalances
        @safe={{this.safe}}
      />
    `);

    assert.dom('[data-test-safe-balances]').containsText('0xB236...6666');
    assert
      .dom('[data-test-safe-balances-network]')
      .containsText(`On ${c.layer2.shortName}`);
    assert.dom('[data-test-safe-balances-count]').containsText('2');
    assert.dom('[data-test-safe-balances-type]').containsText('Depot');

    assert.dom('[data-test-safe-balances-title]').containsText('Depot');
    assert.dom('[data-test-safe-balances-logo=depot-arrows]').exists();
    assert.dom('[data-test-safe-balances-link]').doesNotExist();

    assert
      .dom('[data-test-safe-balances-usd-total]')
      .containsText('$150.02 USD');

    assert
      .dom('[data-test-safe-balances-token="DAI.CPXD"]')
      .containsText('250.11 DAI.CPXD')
      .containsText('$50.02 USD');
    assert
      .dom('[data-test-safe-balances-token="CARD.CPXD"]')
      .containsText('500.00 CARD.CPXD')
      .containsText('$100.00 USD');
  });

  test('it renders a merchant safe', async function (this: Context, assert) {
    this.set('safe', merchantSafe);
    await render(hbs`
      <CardPay::SafeBalances
        @safe={{this.safe}}
      />
    `);
    assert.dom('[data-test-safe-balances-count]').containsText('1');
    assert.dom('[data-test-safe-balances-type]').containsText('Business');

    await settled();
    assert.dom('[data-test-safe-balances-title]').containsText('Mandello');
    assert
      .dom('[data-test-safe-balances-link]')
      .containsText('cardstack.xyz/mandello1')
      .hasAttribute('href', 'https://cardstack.xyz/mandello1');

    assert
      .dom('[data-test-merchant-logo]')
      .containsText('M')
      .hasStyle({
        'background-color': new TinyColor('#00ffcc').toRgbString(),
        color: new TinyColor('#000000').toRgbString(),
      });
  });

  test('it throws an error rendering a prepaid card safe', async function (this: Context, assert) {
    setupOnerror(function (err: Error) {
      assert.equal(
        err.message,
        'CardPay::SafeBalances does not support a safe type of prepaid-card'
      );
    });
    this.set('safe', prepaidCardSafe);
    await render(hbs`
      <CardPay::SafeBalances
        @safe={{this.safe}}
      />
    `);
  });
});
