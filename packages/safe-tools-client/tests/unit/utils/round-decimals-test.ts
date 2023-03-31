import { roundDecimals } from '@cardstack/safe-tools-client/helpers/native-units-to-decimal';
import { module, test } from 'qunit';

module('Unit | roundDecimals', () => {
  test('rounds to decimal points', function (assert) {
    assert.strictEqual(roundDecimals(1.23456789, 2), '1.23');
  });

  test('rounds to decimal points when significant decimal starts after the rounding point', function (assert) {
    assert.strictEqual(roundDecimals(0.000001, 2), '0.000001');
  });
});
