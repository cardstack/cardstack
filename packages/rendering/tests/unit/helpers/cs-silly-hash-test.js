import { csSillyHash } from 'dummy/helpers/cs-silly-hash';
import { module, test } from 'qunit';

module('Unit | Helper | cs silly hash');

test('it works', function(assert) {
  let result = csSillyHash([], { key0: 'hello', value0: 'world' });
  assert.deepEqual(result, { hello: 'world' });
});
