import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const ACTION_CHIN_SELECTOR = '[data-test-boxel-action-chin]';
const MAIN_ACTION_BUTTON_SELECTOR =
  '[data-test-boxel-action-chin] [data-test-boxel-button]:nth-of-type(1)';
const CANCEL_CTA =
  '[data-test-boxel-action-chin] [data-test-boxel-button]:nth-of-type(2)';
const MAIN_ACTION_AREA_SELECTOR =
  '[data-test-boxel-action-chin-action-status-area]';
const MAIN_ACTION_AREA_ICON_SELECTOR =
  '[data-test-boxel-action-chin-action-status-area] .boxel-action-chin__action-status-area-icon';
const INFO_AREA_SELECTOR = '[data-test-boxel-action-chin-info-area]';
const DEFAULT_PRIVATE_NOTICE_SELECTOR =
  '[data-test-boxel-action-chin-private-notice]';

const STEP_DATA_TEST_ATTRIBUTE = 'data-test-boxel-action-chin-step';

module('Integration | Component | ActionChin', function (hooks) {
  setupRenderingTest(hooks);

  const mainActionButtonText = 'mainActionButtonText';
  const cancelActionButtonText = 'cancelActionButtonText';
  const infoAreaText = 'infoAreaText';
  const mainActionAreaText = 'mainActionAreaText';

  test('it accepts and renders the default block with the ActionButton, ActionStatusArea, and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'default',
      mainActionButtonText,
      mainActionAreaText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
        as |a|
      >
        <a.ActionButton>
          {{this.mainActionButtonText}}
        </a.ActionButton>
        <a.InfoArea>
          {{this.infoAreaText}}
        </a.InfoArea>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
    assert.dom(MAIN_ACTION_AREA_SELECTOR).doesNotExist();

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
        as |a|
      >
        <a.ActionStatusArea>
          {{this.mainActionAreaText}}
        </a.ActionStatusArea>
        <a.InfoArea>
          {{this.infoAreaText}}
        </a.InfoArea>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).doesNotExist();
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
    assert.dom(MAIN_ACTION_AREA_SELECTOR).containsText(mainActionAreaText);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).doesNotExist();
  });

  test('it accepts and renders the disabled named block with the ActionButton, and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'disabled',
      stepNumber: null,
      mainActionButtonText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
        @stepNumber={{this.stepNumber}}
      >
        <:disabled as |d|>
          <d.ActionButton>
            {{this.mainActionButtonText}}
          </d.ActionButton>
          <d.InfoArea>
            {{this.infoAreaText}}
          </d.InfoArea>
        </:disabled>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).isDisabled();
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
    assert.dom(MAIN_ACTION_AREA_SELECTOR).doesNotExist();

    this.set('stepNumber', 1);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).doesNotExist();

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it accepts and renders the in-progress named block with the ActionButton, CancelButton, ActionStatusArea and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'in-progress',
      mainActionButtonText,
      cancelActionButtonText,
      infoAreaText,
      mainActionAreaText,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:in-progress as |i|>
        <i.ActionButton>
          {{this.mainActionButtonText}}
        </i.ActionButton>

        <i.CancelButton>
          {{this.cancelActionButtonText}}
        </i.CancelButton>

        <i.InfoArea>
          {{this.infoAreaText}}
        </i.InfoArea>
      </:in-progress>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(CANCEL_CTA).containsText(cancelActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:in-progress as |i|>
        <i.ActionStatusArea>
          {{this.mainActionAreaText}}
        </i.ActionStatusArea>

        <i.InfoArea>
          {{this.infoAreaText}}
        </i.InfoArea>
      </:in-progress>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_AREA_SELECTOR).containsText(mainActionAreaText);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).doesNotExist();
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
  });

  test('it accepts and renders the memorialized named block with the ActionButton, ActionStatusArea, and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'memorialized',
      mainActionButtonText,
      mainActionAreaText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:memorialized as |m|>
      <m.ActionButton>
          {{this.mainActionButtonText}}
        </m.ActionButton>

        <m.ActionStatusArea>
          {{this.mainActionAreaText}}
        </m.ActionStatusArea>

        <m.InfoArea>
          {{this.infoAreaText}}
        </m.InfoArea>
      </:memorialized>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.ActionStatusArea>
          {{this.mainActionAreaText}}
        </m.ActionStatusArea>
      </:memorialized>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_AREA_SELECTOR).containsText(mainActionAreaText);
  });

  test('it changes rendered contents when @state argument changes', async function (assert) {
    const stateText = {
      default: 'Default state here',
      disabled: 'Disabled state here',
      'in-progress': 'In progress state here',
      memorialized: 'Memorialized state here',
    };
    this.setProperties({
      state: 'default',
      stateText,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:default>
        {{get this.stateText "default"}}
      </:default>
      <:disabled>
        {{get this.stateText "disabled"}}
      </:disabled>
      <:in-progress>
        {{get this.stateText "in-progress"}}
      </:in-progress>
      <:memorialized>
        {{get this.stateText "memorialized"}}
      </:memorialized>
      </Boxel::ActionChin>
    `);
    const states = ['default', 'disabled', 'in-progress', 'memorialized'];
    for (const state of states) {
      this.set('state', state);
      assert.dom(ACTION_CHIN_SELECTOR).containsText(stateText[state]);
      for (const state2 of states) {
        if (state2 !== state)
          assert
            .dom(ACTION_CHIN_SELECTOR)
            .doesNotContainText(stateText[state2]);
      }
    }
  });

  test('It renders a step number if @stepNumber is provided', async function (assert) {
    this.setProperties({
      state: 'default',
      stepNumber: 1,
    });
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
        @stepNumber={{this.stepNumber}}
      >
      </Boxel::ActionChin>
    `);

    assert.dom(`[${STEP_DATA_TEST_ATTRIBUTE}="1"]`).containsText('Step 1');
    this.set('stepNumber', 2);
    assert.dom(`[${STEP_DATA_TEST_ATTRIBUTE}="2"]`).containsText('Step 2');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('In the memorialized state, the ActionStatusArea icon can be configured', async function (assert) {
    this.set('state', 'memorialized');
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.ActionStatusArea>
          {{this.mainActionAreaText}}
        </m.ActionStatusArea>
      </:memorialized>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).exists();
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.ActionStatusArea @icon={{null}}>
          {{this.mainActionAreaText}}
        </m.ActionStatusArea>
      </:memorialized>
      </Boxel::ActionChin>
    `);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).doesNotExist();
  });

  test('It renders the private notice regardless of InfoArea component use for the default, in-progress, and memorialized states', async function (assert) {
    this.set('state', 'default');
    await render(hbs`
      <Boxel::ActionChin
        @state={{this.state}}
      >
      <:default as |a|>
        <a.InfoArea>
          Info area that visually replaces the private notice
        </a.InfoArea>
      </:default>
      <:in-progress as |i|>
        <i.InfoArea>
          Info area that visually replaces the private notice
        </i.InfoArea>
      </:in-progress>
      <:memorialized as |m|>
        <m.InfoArea>
          Info area that visually replaces the private notice
        </m.InfoArea>
      </:memorialized>
      </Boxel::ActionChin>
    `);
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
    this.set('state', 'in-progress');
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
    this.set('state', 'memorialized');
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
  });
});
