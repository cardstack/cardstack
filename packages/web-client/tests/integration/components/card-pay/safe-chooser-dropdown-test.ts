import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { setupMirage } from 'ember-cli-mirage/test-support';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

import { TinyColor } from '@ctrl/tinycolor';
import {
  createDepotSafe,
  createMerchantSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/web-client/tests/helpers/data';

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
      this.server.create('merchant-info', {
        id: await getFilenameFromDid(EXAMPLE_DID),
        name: 'Mandello',
        slug: 'mandello1',
        did: EXAMPLE_DID,
        color: '#00ffcc',
        'text-color': '#000000',
        'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
      });

      this.setProperties({
        safes: [
          createDepotSafe({
            address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
            tokens: [
              createSafeToken('CARD', '500000000000000000000'),
              createSafeToken('DAI', '250000000000000000000'),
            ],
          }),
          createMerchantSafe({
            address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
            merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
            tokens: [
              createSafeToken('DAI', '125000000000000000000'),
              createSafeToken('CARD', '450000000000000000000'),
            ],
            accumulatedSpendValue: 100,
            infoDID: EXAMPLE_DID,
          }),
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
        .hasStyle({
          'background-color': new TinyColor('#00ffcc').toRgbString(),
          color: new TinyColor('#000000').toRgbString(),
        });
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
