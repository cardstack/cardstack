import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | index', function(hooks) {
  setupApplicationTest(hooks);

  test('renders own page content', async function(assert) {
    await visit('/c');
    assert.equal(currentURL(), '/c');
    assert.equal(this.element.querySelector('.blurb').textContent.trim(), 'this is the homepage');
  });
});
