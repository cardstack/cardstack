import { visit, currentURL } from '@ember/test-helpers';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { setupApplicationTest } from 'ember-qunit';
import { module, test } from 'qunit';

module('Acceptance | accessibility', function (hooks) {
  setupApplicationTest(hooks);

  test('accessibility check', async function (assert) {
    await visit('/');
    assert.strictEqual(currentURL(), '/schedule');
    await a11yAudit({
      include: [['#ember-testing']],
      exclude: [
        // There's an issue within details tags where contrast is miscalculated
        ['.collapse-panel'],
        // We intentionally want a low-contrast version number
        ['.safe-tools__version'],
      ],
    });
    assert.ok(true, 'no a11y errors found on app home page');
  });
});
