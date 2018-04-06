import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, fillIn, click } from '@ember/test-helpers';

import Fixtures from '@cardstack/test-support/fixtures';

let scenario = new Fixtures({
  create(factory) {
    factory.addResource('items').withAttributes({content: 'hello'});
  },

  destroy() {
    return [{ type: 'items' }];
  }
});

module('Acceptance | live query', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('Adding a record, and seeing it appear in the query', async function(assert) {
    await visit('/');

    let items = Array.from(this.element.querySelectorAll('.item')).map(e=>e.textContent);
    assert.deepEqual(items, ['hello']);

    await fillIn('.new-item-content', 'world');
    await click('.new-item-submit');

    items = Array.from(this.element.querySelectorAll('.item')).map(e=>e.textContent).sort();
    assert.deepEqual(items, ['hello', 'world'])

  });
});
