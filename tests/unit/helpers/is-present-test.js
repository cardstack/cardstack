import { isPresent } from 'dummy/helpers/is-present';
import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Helper | is-present', function (hooks) {
  setupTest(hooks);

  test('takes an a value and returns a bool', function (assert) {
    assert.equal(isPresent([null]), false);
    assert.equal(isPresent([undefined]), false);
    assert.equal(isPresent(['']), false);
    assert.equal(isPresent(['  ']), false);
    assert.equal(isPresent(['\n\t']), false);
    assert.equal(isPresent([false]), true);
    assert.equal(isPresent([true]), true);
    assert.equal(isPresent(['string']), true);
    assert.equal(isPresent([0]), true);
    assert.equal(isPresent(['\n\t Hello']), true);

    assert.equal(isPresent([1, 0]), true);

    assert.equal(isPresent([1, null]), false);
  });
});
