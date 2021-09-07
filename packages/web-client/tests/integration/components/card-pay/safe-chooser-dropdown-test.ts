import { module, skip, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled } from '@ember/test-helpers';
import { TestContext } from 'ember-test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';

interface Context extends TestContext {
  safes: Safe[];
}

let chosenSafe: Safe | null = null;

module(
  'Integration | Component | card-pay/safe-chooser-dropdown',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
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
      assert
        .dom('.ember-power-select-options li:nth-child(1)')
        .containsText('DEPOT 0xB236ca8DbAB0644ffCD32518eBF4924ba8666666');
      assert
        .dom('.ember-power-select-options li:nth-child(2)')
        .containsText('MERCHANT 0xmerchantbAB0644ffCD32518eBF4924ba8666666');
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

      this.set('selectedSafe', this.safes[0]);
      await settled();

      assert
        .dom('[data-test-safe-chooser-dropdown]')
        .containsText(this.safes[0].address);
    });

    skip('it renders the first safe as chosen by default');
  }
);
