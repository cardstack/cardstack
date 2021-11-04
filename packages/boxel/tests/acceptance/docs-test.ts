import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { a11yAudit } from 'ember-a11y-testing/test-support';
import percySnapshot from '@percy/ember';

module('Acceptance | Docs', function (hooks) {
  setupApplicationTest(hooks);

  test('accessibility check', async function (assert) {
    await visit('/docs');
    // Only audit usage-preview examples
    await a11yAudit({
      include: ['.FreestyleUsage-preview'],
      // https://github.com/dequelabs/axe-core/issues/3082
      // turn off the rule for aria-allowed-role for now until ember-a11y-testing is updated with bugfix from axe-core
      rules: {
        'aria-allowed-role': { enabled: false },
      },
    });
    assert.ok(true, 'no a11y errors found!');
  });

  test('percy visual diffs testing', async function (assert) {
    await visit('/docs');
    await percySnapshot('Boxel Docs');
    assert.ok(true, 'percy snapshot taken');
  });
});
