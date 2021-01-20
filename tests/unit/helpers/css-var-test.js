import { cssVar } from '@cardstack/boxel/helpers/css-var';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Helper | css-var', function(hooks) {
  setupTest(hooks);

  test('takes an object and converts it to css variables', function(assert) {
    assert.equal(cssVar({ foo: 'bar' }), "--foo: bar");
    assert.equal(cssVar({
      foo: 'bar',
      baz: 1
    }), "--foo: bar; --baz: 1");

    assert.equal(cssVar({
      'foo-bar': 'baz',
    }), "--foo-bar: baz");

    assert.equal(cssVar({
      'fooBar': 'baz',
    }), "--fooBar: baz");

    let fun = function() { return 'baz'};
    assert.equal(cssVar({
      'fooBar': fun
    }), "--fooBar: baz");
  });
});
