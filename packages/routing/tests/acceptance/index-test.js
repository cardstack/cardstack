import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | index', function(hooks) {
  setupApplicationTest(hooks);

  test('renders default application card', async function(assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    assert.equal(this.element.querySelector('h2').textContent.trim(), 'Welcome to Cardstack!');
  });
});
