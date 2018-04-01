import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | default content', function(hooks) {
  setupApplicationTest(hooks);

  test('renders own page content', async function(assert) {
    await visit('/c/second');
    assert.equal(currentURL(), '/c/second');
    assert.equal(this.element.querySelector('.blurb').textContent.trim(), 'I am the second page');
  });
});
