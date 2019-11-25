import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';

module('Acceptance | event card', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /event-card', async function(assert) {
    await visit('cards/event-card/');
    assert.equal(currentURL(), 'cards/event-card/');
    await percySnapshot(assert)
  });
});
