import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { find, render, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';

import {
  createDepotSafe,
  createMerchantSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

let walletAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

module(
  'Integration | Component | card-pay/balance-view-banner',
  function (hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    test('it renders a depot safe token balance', async function (this: Context, assert) {
      let depotAddress = '0xdepot000bAB0644ffCD32518eBF4924ba8666666';

      this.set('walletAddress', walletAddress);
      this.set(
        'safe',
        createDepotSafe({
          address: depotAddress,
          tokens: [createSafeToken('DAI', '23240000000000000000')],
        })
      );

      await render(hbs`
        <CardPay::BalanceViewBanner
          @walletAddress={{this.walletAddress}}
          @safe={{this.safe}}
          @token="DAI.CPXD"
        />
      `);

      assert
        .dom('[data-test-balance-view-summary]')
        .containsText('Account')
        .containsText('0x1826...6E44')
        .containsText('DEPOT')
        .containsText('23.24 DAI.CPXD');

      assert
        .dom('[data-test-balance-view-account-address')
        .containsText('Account:')
        .containsText(walletAddress);

      // FIXME
      assert
        .dom('[data-test-balance-view-depot-address')
        .containsText('DEPOT:')
        .containsText(depotAddress);

      assert
        .dom('[data-test-balance-view-depot-address] [data-test-icon=depot]')
        .exists();

      assert
        .dom('[data-test-balance-view-token-amount')
        .containsText('23.24 DAI.CPXD');
    });

    test('it renders a merchant safe token balance', async function (this: Context, assert) {
      let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';

      const MERCHANT_DID =
        'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';
      this.set('walletAddress', walletAddress);
      this.set(
        'safe',
        createMerchantSafe({
          address: merchantAddress,
          merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          tokens: [
            createSafeToken('DAI', '125000000000000000000'),
            createSafeToken('CARD', '450110000000000000000'),
          ],
          accumulatedSpendValue: 100,
          infoDID: MERCHANT_DID,
        })
      );

      this.server.create('merchant-info', {
        id: await getFilenameFromDid(MERCHANT_DID),
        name: 'Mandello',
        slug: 'mandello1',
        did: MERCHANT_DID,
      });

      await render(hbs`
        <CardPay::BalanceViewBanner
          @walletAddress={{this.walletAddress}}
          @safe={{this.safe}}
          @token="CARD.CPXD"
        />
      `);

      // Wait for merchant resource to fetch
      await waitUntil(() =>
        find('[data-test-balance-view-summary]')?.textContent?.includes(
          'Mandello'
        )
      );

      assert
        .dom('[data-test-balance-view-summary]')
        .containsText('Account')
        .containsText('0x1826...6E44')
        .containsText('Merchant Mandello')
        .containsText('450.11 CARD.CPXD');

      assert
        .dom('[data-test-balance-view-account-address')
        .containsText('Account:')
        .containsText(walletAddress);

      // FIXME
      assert
        .dom('[data-test-balance-view-depot-address')
        .containsText('Merchant Mandello:')
        .containsText(merchantAddress);

      assert
        .dom('[data-test-balance-view-depot-address] [data-test-icon=merchant]')
        .exists();

      assert
        .dom('[data-test-balance-view-token-amount')
        .containsText('450.11 CARD.CPXD');
    });
  }
);
