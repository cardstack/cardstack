import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import Boxel<%= classifiedModuleName %> from '@cardstack/boxel/components/boxel/<%= dasherizedModuleName %>';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const COMPONENT_SELECTOR = '[data-test-<%= cssClassName %>]';

module('Integration | Component | <%= classifiedModuleName %>', function (hooks) {
  setupRenderingTest(hooks);

  test('Accessibility Check', async function (assert) {
    await render(<template>
      <Boxel<%= classifiedModuleName %>>Hello world</Boxel<%= classifiedModuleName %>>
    </template>);
    assert.dom(COMPONENT_SELECTOR).hasText('Hello world');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });
});
