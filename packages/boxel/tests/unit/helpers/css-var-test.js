import { cssVar } from '@cardstack/boxel/helpers/css-var';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Helper | css-var', function (hooks) {
  setupTest(hooks);

  test('takes an object and converts it to css variables', function (assert) {
    assert.strictEqual(cssVar({ foo: 'bar' }), '--foo: bar');
    assert.strictEqual(
      cssVar({
        foo: 'bar',
        baz: 1,
      }),
      '--foo: bar; --baz: 1'
    );

    assert.strictEqual(
      cssVar({
        'foo-bar': 'baz',
      }),
      '--foo-bar: baz'
    );

    assert.strictEqual(
      cssVar({
        fooBar: 'baz',
      }),
      '--fooBar: baz'
    );

    let fun = function () {
      return 'baz';
    };
    assert.strictEqual(
      cssVar({
        fooBar: fun,
      }),
      '--fooBar: baz'
    );
  });
});
