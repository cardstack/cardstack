import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | new-content', function(hooks) {
  setupApplicationTest(hooks);

  test('renders', async function(assert) {
    await visit('/c/posts/new');
    assert.equal(currentURL(), '/c/posts/new');
    assert.equal(this.element.querySelectorAll('.title').length, 1);
  });

  test('renders default content type', async function(assert) {
    await visit('/c/pages/new');
    assert.equal(currentURL(), '/c/pages/new');
    assert.equal(this.element.querySelectorAll('.blurb').length, 1);
  });
});
