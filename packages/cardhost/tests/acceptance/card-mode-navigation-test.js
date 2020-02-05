import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | card mode navigation', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /card-mode-navigation', async function(assert) {
    await visit('/card-mode-navigation');

    assert.equal(currentURL(), '/card-mode-navigation');
  });
});
