import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

const CTA_BLOCK_SELECTOR = '[data-test-boxel-cta-block]';
const MAIN_ACTION_BUTTON_SELECTOR =
  '[data-test-boxel-cta-block-button].boxel-cta-block__action-button';
const CANCEL_ACTION_BUTTON_SELECTOR =
  '[data-test-boxel-cta-block-button].boxel-cta-block__cancel-action-button';
const MAIN_ACTION_AREA_SELECTOR =
  '[data-test-boxel-cta-block-main-action-area]';
const MAIN_ACTION_AREA_ICON_SELECTOR =
  '[data-test-boxel-cta-block-main-action-area] .boxel-cta-block__main-action-area-icon';
const INFO_AREA_SELECTOR = '[data-test-boxel-cta-block-area]';
const DEFAULT_PRIVATE_NOTICE_SELECTOR =
  '[data-test-boxel-cta-block-private-notice]';

const STEP_DATA_TEST_ATTRIBUTE = 'data-test-boxel-cta-block-step';

module('Integration | Component | CtaBlock', function (hooks) {
  setupRenderingTest(hooks);

  const mainActionButtonText = 'mainActionButtonText';
  const cancelActionButtonText = 'cancelActionButtonText';
  const infoAreaText = 'infoAreaText';
  const mainActionAreaText = 'mainActionAreaText';

  test('it accepts and renders the default block with the ActionButton and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'default',
      mainActionButtonText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
        as |a|
      >
        <a.ActionButton>
          {{this.mainActionButtonText}}
        </a.ActionButton>
        <a.InfoArea>
          {{this.infoAreaText}}
        </a.InfoArea>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
  });

  test('it accepts and renders the disabled named block with the ActionButton component', async function (assert) {
    this.setProperties({
      state: 'disabled',
      mainActionButtonText,
    });
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:disabled as |d|>
        <d.ActionButton>
          {{this.mainActionButtonText}}
        </d.ActionButton>
      </:disabled>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).isDisabled();
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).isNotVisible();
  });

  test('it accepts and renders the in-progress named block with the ActionButton, CancelActionButton, and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'in-progress',
      mainActionButtonText,
      cancelActionButtonText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:in-progress as |i|>
        <i.ActionButton>
          {{this.mainActionButtonText}}
        </i.ActionButton>

        <i.CancelActionButton>
          {{this.cancelActionButtonText}}
        </i.CancelActionButton>

        <i.InfoArea>
          {{this.infoAreaText}}
        </i.InfoArea>
      </:in-progress>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert
      .dom(CANCEL_ACTION_BUTTON_SELECTOR)
      .containsText(cancelActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);
  });

  test('it accepts and renders the memorialized named block with the ActionButton, MainActionArea, and InfoArea components', async function (assert) {
    this.setProperties({
      state: 'memorialized',
      mainActionButtonText,
      mainActionAreaText,
      infoAreaText,
    });
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:memorialized as |m|>
      <m.ActionButton>
          {{this.mainActionButtonText}}
        </m.ActionButton>

        <m.MainActionArea>
          {{this.mainActionAreaText}}
        </m.MainActionArea>

        <m.InfoArea>
          {{this.infoAreaText}}
        </m.InfoArea>
      </:memorialized>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_BUTTON_SELECTOR).containsText(mainActionButtonText);
    assert.dom(INFO_AREA_SELECTOR).containsText(infoAreaText);

    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.MainActionArea>
          {{this.mainActionAreaText}}
        </m.MainActionArea>
      </:memorialized>
      </Boxel::CtaBlock>
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
      <Boxel::CtaBlock
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
      </Boxel::CtaBlock>
    `);
    const states = ['default', 'disabled', 'in-progress', 'memorialized'];
    for (const state of states) {
      this.set('state', state);
      assert.dom(CTA_BLOCK_SELECTOR).containsText(stateText[state]);
      for (const state2 of states) {
        if (state2 !== state)
          assert.dom(CTA_BLOCK_SELECTOR).doesNotContainText(stateText[state2]);
      }
    }
  });

  test('It renders a step number if @stepNumber is provided', async function (assert) {
    this.setProperties({
      state: 'default',
      stepNumber: 1,
    });
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
        @stepNumber={{this.stepNumber}}
      >
      </Boxel::CtaBlock>
    `);

    assert.dom(`[${STEP_DATA_TEST_ATTRIBUTE}="1"]`).containsText('Step 1');
    this.set('stepNumber', 2);
    assert.dom(`[${STEP_DATA_TEST_ATTRIBUTE}="2"]`).containsText('Step 2');
  });

  test('In the memorialized state, the MainActionArea icon can be configured', async function (assert) {
    this.set('state', 'memorialized');
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.MainActionArea>
          {{this.mainActionAreaText}}
        </m.MainActionArea>
      </:memorialized>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).exists();
    await render(hbs`
      <Boxel::CtaBlock
        @state={{this.state}}
      >
      <:memorialized as |m|>
        <m.MainActionArea @icon={{null}}>
          {{this.mainActionAreaText}}
        </m.MainActionArea>
      </:memorialized>
      </Boxel::CtaBlock>
    `);
    assert.dom(MAIN_ACTION_AREA_ICON_SELECTOR).doesNotExist();
  });

  test('It renders the private notice regardless of InfoArea component use for the default, in-progress, and memorialized states', async function (assert) {
    this.set('state', 'default');
    await render(hbs`
      <Boxel::CtaBlock
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
      </Boxel::CtaBlock>
    `);
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
    this.set('state', 'in-progress');
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
    this.set('state', 'memorialized');
    assert.dom(DEFAULT_PRIVATE_NOTICE_SELECTOR).exists();
  });
});
