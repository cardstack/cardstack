import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import click from '@ember/test-helpers/dom/click';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | ActionContainer', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders in data-entry mode by default', async function (assert) {
    await render(hbs`
      <Boxel::ActionContainer
        @header="Action Card"
        @incompleteActionLabel="Save"
      >
        <div data-test-action-container-test-content>Card</div>
      </Boxel::ActionContainer>
    `);
    assert.dom('[data-test-boxel-action-container]').exists();
    assert
      .dom('[data-test-boxel-action-container]')
      .doesNotHaveClass('boxel-action-container--is-complete');
    assert.dom('[data-test-boxel-action-header]').exists();
    assert.dom('[data-test-boxel-action-header]').hasText('Action Card');
    assert.dom('[data-test-boxel-action-prompt]').doesNotExist();
    assert.dom('[data-test-action-container-test-content]').hasText('Card');
    assert.dom('[data-test-boxel-action-footer]').exists();
    assert.dom('[data-test-boxel-action-footer] button').hasText('Save');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can render with a prompt', async function (assert) {
    await render(hbs`
        <Boxel::ActionContainer
        @header="Action Card"
        @prompt="Please enter name"
        @incompleteActionLabel="Save"
      >
        <div>Card</div>
      </Boxel::ActionContainer>
    `);

    assert.dom('[data-test-boxel-action-container]').exists();
    assert.dom('[data-test-boxel-action-prompt]').hasText('Please enter name');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can render in memorialized mode', async function (assert) {
    await render(hbs`
      <Boxel::ActionContainer
        @isComplete={{true}}
        @header="Action Card"
        @completeActionLabel="Edit"
      >
        <div>Card</div>
      </Boxel::ActionContainer>
    `);

    assert.dom('[data-test-boxel-action-container]').exists();
    assert
      .dom('[data-test-boxel-action-container]')
      .hasClass('boxel-action-container--is-complete');
    assert.dom('[data-test-boxel-action-footer] button').hasText('Edit');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can accept function to switch from data-entry mode to memorialized mode', async function (assert) {
    this.isComplete = false;
    this.save = () => this.set('isComplete', !this.isComplete);

    await render(hbs`
      <Boxel::ActionContainer
        @isComplete={{this.isComplete}}
        @header="Action Card"
        @incompleteActionLabel="Save"
        @completeActionLabel="Edit"
        @onClickButton={{this.save}}
      >
        <div>
          <Boxel::Field
            @label="Full Name"
            @tag={{if this.isComplete "div" "label"}}
          >
            {{# if this.isComplete}}
              <span data-test-action-container-test-value>Gary Walker</span>
            {{else}}
              <Boxel::Input @value="Gary Walker" />
            {{/if}}
          </Boxel::Field>
        </div>
      </Boxel::ActionContainer>
    `);

    assert.dom('[data-test-boxel-action-container]').exists();
    assert
      .dom('[data-test-boxel-action-container]')
      .doesNotHaveClass('boxel-action-container--is-complete');
    assert.dom('[data-test-boxel-action-container] label').hasText('Full Name');
    assert
      .dom('[data-test-boxel-action-container] input')
      .hasValue('Gary Walker');
    assert.dom('[data-test-boxel-action-footer] button').hasText('Save');

    await click('[data-test-boxel-action-footer] button');

    assert
      .dom('[data-test-boxel-action-container]')
      .hasClass('boxel-action-container--is-complete');
    assert.dom('[data-test-boxel-action-container] label').doesNotExist();
    assert.dom('[data-test-boxel-action-container] input').doesNotExist();
    assert.dom('[data-test-boxel-field-label]').hasText('Full Name');
    assert
      .dom('[data-test-action-container-test-value]')
      .hasText('Gary Walker');
    assert.dom('[data-test-boxel-action-footer] button').hasText('Edit');
  });
});
