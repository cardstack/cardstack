import { module, skip, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

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
        chooseSafe: () => {},
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

    skip('it returns the chosen safe to the handler');

    skip('it renders with the chosen safe chosen');

    skip('it renders the first safe as chosen by default');
  }
);
