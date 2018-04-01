import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL } from '@ember/test-helpers';

module('Acceptance | card', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /card', async function(assert) {
    await visit('/card');

    assert.equal(currentURL(), '/card');
    assert.equal(this.element.querySelector('.card-flavor').textContent.trim(), 'tea');
    assert.equal(this.element.querySelector('.card-size').textContent.trim(), '1 cup');
  });
});
