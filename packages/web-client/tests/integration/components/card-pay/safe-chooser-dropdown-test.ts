import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

interface Context extends MirageTestContext {
  safes: Safe[];
}

let chosenSafe: Safe | null = null;

const EXAMPLE_DID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

module(
  'Integration | Component | card-pay/safe-chooser-dropdown',
  function (hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      let resolver = new Resolver({ ...getResolver() });
      let resolvedDID = await resolver.resolve(EXAMPLE_DID);
      let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs![0]!;
      let customizationJsonFilename = didAlsoKnownAs
        .split('/')[4]
        .split('.')[0];

      this.server.create('merchant-info', {
        id: customizationJsonFilename,
        name: 'Mandello',
        slug: 'mandello1',
        did: EXAMPLE_DID,
        color: '#00ffcc',
        'text-color': '#000000',
        'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
      });

      this.setProperties({
        safes: [
          {
            type: 'depot',
            address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
            tokens: [
              {
                balance: '250000000000000000000',
                token: {
                  symbol: 'DAI',
                },
              },
              {
                balance: '500000000000000000000',
                token: {
                  symbol: 'CARD',
                },
              },
            ],
          },
          {
            type: 'merchant',
            createdAt: Date.now() / 1000,
            address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
            merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
            tokens: [
              {
                balance: '125000000000000000000',
                tokenAddress: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
                token: {
                  name: 'Dai Stablecoin.CPXD',
                  symbol: 'DAI',
                  decimals: 2,
                },
              },
              {
                balance: '450000000000000000000',
                tokenAddress: '0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee',
                token: {
                  name: 'CARD Token Kovan.CPXD',
                  symbol: 'CARD',
                  decimals: 2,
                },
              },
            ],
            owners: [],
            accumulatedSpendValue: 100,
            infoDID: EXAMPLE_DID,
          },
        ],
        chooseSafe: (safe: Safe) => (chosenSafe = safe),
      });
    });

    test('it renders choices for each passed-in safe', async function (assert) {
      await render(hbs`
        <CardPay::SafeChooserDropdown
          @safes={{this.safes}}
          @selectedSafe={{this.selectedSafe}}
          @onChooseSafe={{this.chooseSafe}}
        />
      `);

      await click('.ember-power-select-trigger');
      assert.dom('.ember-power-select-options li').exists({ count: 2 });
      await settled();
      assert
        .dom('.ember-power-select-options li:nth-child(1)')
        .containsText('DEPOT 0xB236ca8DbAB0644ffCD32518eBF4924ba8666666');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText('Mandello')
        .containsText('Merchant account')
        .containsText('0xmerchantbAB0644ffCD32518eBF4924ba8666666');
      assert
        .dom(
          '.ember-power-select-options li:nth-child(2) [data-test-merchant-logo]'
        )
        .containsText('M')
        .hasAttribute('data-test-merchant-logo-background', '#00ffcc')
        .hasAttribute('data-test-merchant-logo-text-color', '#000000');
    });

    test('it returns the chosen safe to the handler', async function (this: Context, assert) {
      await render(hbs`
        <CardPay::SafeChooserDropdown
          @safes={{this.safes}}
          @selectedSafe={{this.selectedSafe}}
          @onChooseSafe={{this.chooseSafe}}
        />
    `);

      await click('.ember-power-select-trigger');
      await click('.ember-power-select-options li:nth-child(2)');

      assert.equal(chosenSafe, this.safes[1]);
    });

    test('it renders with @selectedSafe chosen', async function (this: Context, assert) {
      this.set('selectedSafe', this.safes[1]);
      await render(hbs`
        <CardPay::SafeChooserDropdown
          @safes={{this.safes}}
          @selectedSafe={{this.selectedSafe}}
          @onChooseSafe={{this.chooseSafe}}
        />
      `);

      assert
        .dom('[data-test-safe-chooser-dropdown]')
        .containsText(this.safes[1].address);

      await click('.ember-power-select-trigger');
      assert
        .dom(
          '.ember-power-select-options li:nth-child(2) .safe-chooser-dropdown__option--selected'
        )
        .exists();

      this.set('selectedSafe', this.safes[0]);
      await settled();

      assert
        .dom('[data-test-safe-chooser-dropdown]')
        .containsText(this.safes[0].address);
    });

    test('it renders the first safe as chosen by default', async function (this: Context, assert) {
      await render(hbs`
        <CardPay::SafeChooserDropdown
          @safes={{this.safes}}
          @onChooseSafe={{this.chooseSafe}}
        />
      `);

      assert
        .dom('[data-test-safe-chooser-dropdown]')
        .containsText(this.safes[0].address);

      await click('.ember-power-select-trigger');
      assert
        .dom(
          '.ember-power-select-options li:nth-child(1) .safe-chooser-dropdown__option--selected'
        )
        .exists();
    });
  }
);
