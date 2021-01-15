import QUnit from 'qunit';
import { add } from '../src/index';

QUnit.module('Core Placeholder', function () {
  QUnit.test('placeholder test', async function (assert) {
    assert.equal(add(1, 1), 2);
  });
});
