/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, focus, triggerKeyEvent } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | Dropdown', function (hooks) {
  setupRenderingTest(hooks);
  const TRIGGER = '[data-test-boxel-dropdown-trigger]';
  const DROPDOWN_CONTENT = '[data-test-boxel-dropdown-content]';
  const CLOSE_BUTTON = '[data-test-close-button]';
  const LINK_OUTSIDE = '[data-test-link-outside]';
  const LINK_INSIDE = '[data-test-link-inside]';

  hooks.beforeEach(async function (this) {
    await render(hbs`
      <a data-test-link-outside href="#">Control</a>
      <Boxel::Dropdown>
        <:trigger>
          Trigger
        </:trigger>
        <:content as |dd|>
          <a data-test-link-inside href="#">
            Link
          </a>
          <button data-test-close-button {{on "click" dd.close}}>Close</button>
        </:content>
      </Boxel::Dropdown>
    `);
  });

  test('it renders dropdown trigger, but not dropdown content at initialization', async function (assert) {
    assert.dom(TRIGGER).isVisible().containsText('Trigger');
    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it can open and close on trigger click', async function (assert) {
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it can open and close on space', async function (assert) {
    await focus(TRIGGER);
    // https://w3c.github.io/uievents/#fixed-virtual-key-codes
    await triggerKeyEvent(TRIGGER, 'keydown', 32);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await triggerKeyEvent(TRIGGER, 'keydown', 32);

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it can open and close on enter', async function (assert) {
    await focus(TRIGGER);
    // https://w3c.github.io/uievents/#fixed-virtual-key-codes
    await triggerKeyEvent(TRIGGER, 'keydown', 13);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await triggerKeyEvent(TRIGGER, 'keydown', 13);

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it assigns focus to the trigger when opened', async function (assert) {
    await click(TRIGGER);

    assert.strictEqual(document.activeElement, document.querySelector(TRIGGER));
  });

  test('it can close on click outside', async function (assert) {
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await click(document.querySelector('#ember-testing')!, {
      clientX: 100,
      clientY: 100,
    });

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it can close on escape', async function (assert) {
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await triggerKeyEvent(
      this.element.querySelector(DROPDOWN_CONTENT)!.parentElement!,
      'keydown',
      27
    );

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it can close with yielded action', async function (assert) {
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await click(CLOSE_BUTTON);

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
  });

  test('it returns focus to the dropdown trigger when closed', async function (assert) {
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).doesNotExist();
    assert.strictEqual(document.activeElement, document.querySelector(TRIGGER));
  });

  test('it traps focus', async function (assert) {
    // We can't test tabbing, but we can test that focus trap is preventing focusin events
    // from taking focus out
    await click(TRIGGER);

    assert.dom(DROPDOWN_CONTENT).isVisible();

    await focus(LINK_INSIDE);

    assert.strictEqual(
      document.activeElement,
      document.querySelector(LINK_INSIDE)!
    );

    await focus(CLOSE_BUTTON);

    assert.strictEqual(
      document.activeElement,
      document.querySelector(CLOSE_BUTTON)!
    );

    await focus(LINK_OUTSIDE);

    assert.notEqual(
      document.activeElement,
      document.querySelector(LINK_OUTSIDE)!
    );
  });

  test('it does not trap focus when closed', async function (assert) {
    await focus(TRIGGER);

    assert.strictEqual(document.activeElement, document.querySelector(TRIGGER));

    await focus(LINK_OUTSIDE);

    assert.strictEqual(
      document.activeElement,
      document.querySelector(LINK_OUTSIDE)
    );
  });
});
