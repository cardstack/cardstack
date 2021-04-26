import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Acceptance | accessibility', function (hooks) {
  setupApplicationTest(hooks);

  test('accessibility check', async function (assert) {
    await visit('/');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found on cardstack orgs landing page');

    await visit('/card-pay');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found on /card-pay');

    await visit('/card-pay/balances');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found on /card-pay/balances ');
  });
});
