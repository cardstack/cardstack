import { TokenDetail } from '@cardstack/cardpay-sdk';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { BigNumber } from 'ethers';
import { module, test } from 'qunit';

module('Unit | TokenQuantity', () => {
  let tokenCount: BigNumber;
  let token: TokenDetail;

  module('USDC example', function (hooks) {
    hooks.beforeEach(() => {
      token = {
        address: '0x2345678901',
        symbol: 'USDC',
        name: 'Example USDC',
        decimals: 6,
      };
      tokenCount = BigNumber.from('200000000'); // e.g. $200
    });

    test('exposes a symbol', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).symbol,
        token.symbol
      );
    });

    test('exposes the token adddress', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).address,
        token.address
      );
    });

    test('exposes the decimals of the token', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).decimals,
        token.decimals
      );
    });

    test('generates decimalString', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).decimalString,
        '200'
      );
    });

    test('limits decimalString to 6 significant digits', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('3141592')).decimalString,
        '3.14159'
      );
    });

    test('elides trailing zeroes from decimalString', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('3140000')).decimalString,
        '3.14'
      );
    });

    test('avoids scientific notation for decimalString (small numbers)', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('314')).decimalString,
        '0.000314'
      );
    });

    test('avoids scientific notation for decimalString (large numbers)', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('314000000000001'))
          .decimalString,
        '314000000'
      );
    });

    test('generates displayable', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).displayable,
        '200 USDC'
      );
    });
  });

  module('WETH example', function (hooks) {
    hooks.beforeEach(() => {
      token = {
        address: '0x3456789012',
        symbol: 'WETH',
        name: 'Example WETH',
        decimals: 18,
      };
      tokenCount = BigNumber.from('200000000000000000000'); // e.g. $200
    });

    test('exposes a symbol', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).symbol,
        token.symbol
      );
    });

    test('exposes the token adddress', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).address,
        token.address
      );
    });

    test('exposes the decimals of the token', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).decimals,
        token.decimals
      );
    });

    test('generates decimalString', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).decimalString,
        '200'
      );
    });

    test('limits decimalString to 6 significant digits', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('3141592653591234567'))
          .decimalString,
        '3.14159'
      );
    });

    test('elides trailing zeroes from decimalString', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('3140000000000100000'))
          .decimalString,
        '3.14'
      );
    });

    test('avoids scientific notation for decimalString', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, BigNumber.from('314000000000')).decimalString,
        '0.000000314'
      );
    });

    test('generates displayable', function (assert) {
      assert.strictEqual(
        new TokenQuantity(token, tokenCount).displayable,
        '200 WETH'
      );
    });
  });
});
