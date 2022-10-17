import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | ActionContainer', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders in data-entry mode by default', async function (assert) {
    await render(hbs`
      <Boxel::ActionContainer @header="Action Card">
        <div data-test-action-container-test-content>Card</div>
      </Boxel::ActionContainer>
    `);
    assert.dom('[data-test-boxel-action-container]').exists();
    assert.dom('[data-test-boxel-action-header]').exists();
    assert.dom('[data-test-boxel-action-header]').hasText('Action Card');
    assert.dom('[data-test-action-container-test-content]').hasText('Card');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can render with ActionChin', async function (assert) {
    await render(hbs`
      <Boxel::ActionContainer as |Section ActionChin|>
        <div>Card</div>
        <ActionChin @state="default">
          <:default as |a|>
            <a.ActionButton>
              Save
            </a.ActionButton>
          </:default>
        </ActionChin>
      </Boxel::ActionContainer>
    `);

    assert.dom('[data-test-boxel-action-container]').exists();
    assert.dom(this.element.querySelector('button')).hasText('Save');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });
});
