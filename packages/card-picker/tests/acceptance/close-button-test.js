import { module, test } from 'qunit';
import { visit, click, waitFor, waitUntil, find} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | close button', function(hooks) {
  setupApplicationTest(hooks);

  test('Open button opens bottom edge', async function(assert) {
    await visit('/');
    await click('[data-test-open-bottom-edge]');
    await waitFor('[data-card-picker-toolbox-header]');
    assert.dom('[data-card-picker-toolbox-header]').exists();
    assert.dom('[data-test-card-picker-close-button]').exists();
  });

  test('Close button closes bottom edge', async function(assert) {
    await visit('/');
    await click('[data-test-open-bottom-edge]');
    await waitFor('[data-card-picker-toolbox-header]');
    await click('[data-test-card-picker-close-button]');

    await waitUntil(() => {
      return !find('[data-card-picker-toolbox-header]');
    });

    assert.dom('[data-card-picker-toolbox-header]').doesNotExist();
    assert.dom('[data-test-card-picker-close-button]').doesNotExist();
  });
});
