import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | not-found', function (hooks) {
  setupApplicationTest(hooks);

  test('it shows a 404 page for unknown routes', async function (assert) {
    await visit('/blah');

    assert.equal(currentURL(), '/blah');

    assert
      .dom('[data-test-not-found-page]')
      .containsText('The page you are looking for does not exist');

    assert.dom('[data-test-back-home-link]').exists().hasAttribute('href', '/');
  });
});
