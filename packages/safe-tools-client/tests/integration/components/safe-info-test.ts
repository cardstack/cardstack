/* eslint-disable @typescript-eslint/no-empty-function */
import { render } from '@ember/test-helpers';

import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

module('Integration | Component | safe-info', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders a single safe when there is only one safe', async function (assert) {
    assert.expect(2);

    this.set('onSelectSafe', () => {});
    this.set('onDepositClick', () => {});

    await render(hbs`
        <SafeInfo
          @safes={{array (hash address="0x5f62B165B2414C3917487297a42253dF18a55478")}}
          @currentSafe={{(hash address="0x5f62B165B2414C3917487297a42253dF18a55478")}}
          @onSelectSafe={{this.onSelectSafe}}
          @onDepositClick={{this.onDepositClick}}
        />
      `);

    assert
      .dom('[data-test-safe-address-label] .blockchain-address')
      .hasText('0x5f62...5478');
    assert.dom('[data-test-safe-dropdown]').doesNotExist();
  });

  test('It renders safe info dropdown when there are multiple safes', async function (assert) {
    assert.expect(3);

    this.set('onSelectSafe', () => {});
    this.set('onDepositClick', () => {});

    await render(hbs`
        <SafeInfo
          @safes={{array (hash address="0x5f62B165B2414C3917487297a42253dF18a55478") (hash address="0x7bc2B165B2414C3917487297a42253dF18a55123")}}
          @currentSafe={{(hash address="0x5f62B165B2414C3917487297a42253dF18a55478")}}
          @onSelectSafe={{this.onSelectSafe}}
          @onDepositClick={{this.onDepositClick}}
        />
      `);

    assert
      .dom('[data-test-safe-address-label] .blockchain-address')
      .doesNotExist();
    assert.dom('[data-test-safe-dropdown]').exists();
    assert
      .dom('.ember-power-select-trigger .blockchain-address')
      .hasText('0x5f62...5478');
  });

  test('It renders token balances without zero or dust amounts', async function (assert) {
    assert.expect(2);

    this.set('onSelectSafe', () => {});
    this.set('onDepositClick', () => {});
    this.set('tokenBalances', [
      {
        symbol: 'ETH',
        decimals: 18,
        balance: BigNumber.from('1000000000000000000'),
      },
      {
        symbol: 'USDC',
        decimals: 6,
        balance: BigNumber.from('100000000'),
      },
      {
        symbol: 'DAI',
        decimals: 18,
        balance: BigNumber.from('100000000000'), // crypto dust (0.00001 DAI)
      },
      {
        symbol: 'WMATIC',
        decimals: 18,
        balance: BigNumber.from('0'),
      },
    ]);

    await render(hbs`
        <SafeInfo
          @safes={{array (hash address="0x5f62B165B2414C3917487297a42253dF18a55478") (hash address="0x7bc2B165B2414C3917487297a42253dF18a55123")}}
          @currentSafe={{(hash address="0x5f62B165B2414C3917487297a42253dF18a55478")}}
          @tokenBalances={{this.tokenBalances}}
          @onSelectSafe={{this.onSelectSafe}}
          @onDepositClick={{this.onDepositClick}}
        />
      `);

    assert.dom('[data-test-token-balance="ETH"]').hasText('1 ETH');
    assert.dom('[data-test-token-balance="USDC"]').hasText('100 USDC');
  });
});
