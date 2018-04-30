import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { waitFor, click, visit } from '@ember/test-helpers';

module('Acceptance | login', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
  });

  test('can login', async function(assert) {
    await visit('/');

    await click('#login-button');

    await waitFor('#logout-button');

    assert.equal(this.element.querySelector('#auth-message').textContent.trim(), 'Has authenticated session: true');
    assert.equal(this.element.querySelector('#test-message').textContent.trim(), 'Did you login? yes');
  });
});
