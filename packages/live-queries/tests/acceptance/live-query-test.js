import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

import Fixtures from '@cardstack/test-support/fixtures';

let scenario = new Fixtures(factory => {
  factory.addResource('items').withAttributes({content: 'hello'});
});

moduleForAcceptance('Acceptance | live query', {
  async beforeEach() {
    await scenario.setup();
  }
});


test('Adding a record, and seeing it appear in the query', async function(assert) {
  await visit('/');

  let items = Array.from(find('.item')).map(e=>e.textContent);
  assert.deepEqual(items, ['hello']);

  await fillIn('.new-item-content', 'world');
  await click('.new-item-submit');

  items = Array.from(find('.item')).map(e=>e.textContent).sort();
  assert.deepEqual(items, ['hello', 'world'])

});
