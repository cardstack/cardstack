import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Acceptance | accessibility', function (hooks) {
  setupApplicationTest(hooks);

  test('accessibility check', async function (assert) {
    await visit('/');
    assert.strictEqual(currentURL(), '/schedule');
    await a11yAudit({
      include: [['#ember-testing']],
      // There's an issue within details tags where contrast is miscalculated
      exclude: [['.collapse-panel']],
    });
    assert.ok(true, 'no a11y errors found on app home page');
  });
});
