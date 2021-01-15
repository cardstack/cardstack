import QUnit from 'qunit';
const { module, test } = QUnit;

import { compile } from '../src/index.js';

module('Card Compiler', function () {
  test('placeholder test', async function (assert) {
    let result = await compile();
    assert.equal(result, 42);
  });
});
