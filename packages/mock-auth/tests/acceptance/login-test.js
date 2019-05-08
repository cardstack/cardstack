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

    assert.dom(this.element.querySelector('#auth-message')).hasText('Has authenticated session: true');
    assert.dom(this.element.querySelector('#test-message')).hasText('Did you login? yes');
  });
});
