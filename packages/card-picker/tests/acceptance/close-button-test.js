import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | close button', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /close-button', async function(assert) {
    await visit('/close-button');

    assert.equal(currentURL(), '/close-button');
  });
});
