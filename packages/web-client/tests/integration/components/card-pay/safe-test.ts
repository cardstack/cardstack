import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, settled, setupOnerror } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';

import {
  createDepotSafe,
  createProfileSafe,
  createPrepaidCardSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/web-client/utils/test-factories';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TinyColor } from '@ctrl/tinycolor';

interface Context extends MirageTestContext {}

const EXAMPLE_DID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

module('Integration | Component | card-pay/safe', function (hooks) {
  setupRenderingTest(hooks);
  setupMirage(hooks);

  let layer2Service: Layer2TestWeb3Strategy;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
  let profileAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';
  let prepaidCardAddress = '0xprepaidDbAB0644ffCD32518eBF4924ba8666666';

  hooks.beforeEach(async function (this: Context) {
    this.server.create('profile', {
      id: await getFilenameFromDid(EXAMPLE_DID),
      name: 'Mandello',
      slug: 'mandello1',
      did: EXAMPLE_DID,
      color: '#00ffc1',
      'text-color': '#000001',
      'owner-address': layer2AccountAddress,
    });

    layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
  });

  test('it renders a depot safe', async function (this: Context, assert) {
    this.set(
      'safe',
      createDepotSafe({
        address: depotAddress,
        tokens: [
          createSafeToken('DAI.CPXD', '250111100000000000000'),
          createSafeToken('CARD.CPXD', '500000000000000000000'),
        ],
      })
    );
    await render(hbs`
      <CardPay::Safe
        @safe={{this.safe}}
      />
    `);

    assert.dom('[data-test-safe]').containsText('0xB236...6666');
    assert
      .dom('[data-test-safe-network]')
      .containsText(`On ${c.layer2.shortName}`);
    assert.dom('[data-test-safe-count]').containsText('2');
    assert.dom('[data-test-safe-type]').containsText('Depot');

    assert.dom('[data-test-safe-title]').containsText('Depot');
    assert.dom('[data-test-safe-logo=depot]').exists();
    assert.dom('[data-test-safe-link]').doesNotExist();

    assert.dom('[data-test-safe-usd-total]').containsText('$150.02 USD');

    assert
      .dom('[data-test-safe-token="DAI.CPXD"]')
      .containsText('250.11 DAI.CPXD')
      .containsText('$50.02 USD');
    assert
      .dom('[data-test-safe-token="CARD.CPXD"]')
      .containsText('500.00 CARD.CPXD')
      .containsText('$100.00 USD');
  });

  test('it renders a merchant safe', async function (this: Context, assert) {
    this.set(
      'safe',
      createProfileSafe({
        address: profileAddress,
        profile: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        tokens: [createSafeToken('DAI.CPXD', '125000000000000000000')],
        accumulatedSpendValue: 100,
        infoDID: EXAMPLE_DID,
      })
    );
    await render(hbs`
      <CardPay::Safe
        @safe={{this.safe}}
      />
    `);
    assert.dom('[data-test-safe-count]').containsText('1');
    assert.dom('[data-test-safe-type]').containsText('Payment Profile');

    await settled();
    assert.dom('[data-test-safe-title]').containsText('Mandello');
    assert
      .dom('[data-test-safe-link]')
      .containsText('cardstack.xyz/mandello1')
      .hasAttribute('href', 'https://cardstack.xyz/mandello1');

    assert.dom('[data-test-safe-header]').hasStyle({
      'background-color': new TinyColor('#00ffc1').toRgbString(),
      color: new TinyColor('#000001').toRgbString(),
    });

    assert
      .dom('[data-test-profile-logo]')
      .containsText('M')
      .hasStyle({
        'background-color': new TinyColor('#00ffc1').toRgbString(),
        color: new TinyColor('#000001').toRgbString(),
      });
  });

  // eslint-disable-next-line qunit/require-expect
  test('it throws an error rendering a prepaid card safe', async function (this: Context, assert) {
    setupOnerror(function (err: Error) {
      assert.strictEqual(
        err.message,
        'CardPay::Safe does not support a safe type of prepaid-card'
      );
    });
    this.set(
      'safe',
      createPrepaidCardSafe({
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
      })
    );
    await render(hbs`
      <CardPay::Safe
        @safe={{this.safe}}
      />
    `);
  });
});
