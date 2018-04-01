import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit } from '@ember/test-helpers';

module('Acceptance | cardstack-url', function(hooks) {
  setupApplicationTest(hooks);

  test('renders correct links', async function(assert) {
    await visit('/links');
    assert.equal(this.element.querySelector('.page-test').textContent.trim(), '/c/the-permalink');
    assert.equal(this.element.querySelector('.post-test').textContent.trim(), '/c/posts/123%2045');
  });
});
