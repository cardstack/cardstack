import { module, test } from 'qunit';
import { visit, currentURL, settled } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';

module('Acceptance | ui components', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /ui-components', async function(assert) {
    await visit('/ui-components');

    assert.equal(currentURL(), '/ui-components');
    await settled();
    await percySnapshot(assert);
  });
});
