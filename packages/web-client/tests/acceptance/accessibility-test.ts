import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { setupMirage } from 'ember-cli-mirage/test-support';

module('Acceptance | accessibility', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('accessibility check', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found on cardstack orgs landing page');

    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/wallet');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found on /card-pay/wallet ');
  });
});
