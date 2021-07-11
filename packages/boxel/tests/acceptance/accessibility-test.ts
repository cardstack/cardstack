import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { a11yAudit } from 'ember-a11y-testing/test-support';

module('Acceptance | accessibility', function (hooks) {
  setupApplicationTest(hooks);

  test('accessibility check', async function (assert) {
    await visit('/docs');
    // Only audit usage-preview examples
    await a11yAudit({
      include: ['.FreestyleUsage-preview'],
    });
    assert.ok(true, 'no a11y errors found!');
  });
});
