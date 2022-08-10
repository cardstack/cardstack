import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, find, focus, triggerEvent, tap } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

import { htmlSafe } from '@ember/template';

module('Integration | Modifier | tippy', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(async function () {
    this.set('content', 'Tooltip');
    // seems like appendTo=parent is necessary
    // to make it possible to detect the tooltip in tests
    await render(hbs`
      <div id="trigger" tabindex="0"
        {{tippy content=this.content appendTo="parent"}}
      >Trigger</div>
    `);
  });

  test('expected html attrs and structure', async function (assert) {
    const trigger = find('#trigger')!;
    await focus(trigger);

    const tippyId = trigger.getAttribute('aria-describedby') as string;
    assert.ok(tippyId, 'trigger has an attached tippy');

    const tippy = find('#' + tippyId)!;
    assert.ok(tippy, 'attached tippy found');

    assert.strictEqual(
      trigger.parentElement!.children.namedItem(tippyId),
      tippy
    );
    assert.strictEqual(trigger.innerHTML, 'Trigger');
    assert.strictEqual(tippy.textContent, 'Tooltip');

    // @ts-ignore property patched onto HTML element
    const tippyInstance = trigger._tippy;
    assert.ok(tippyInstance, 'tippyInstance');
    assert.strictEqual(tippyInstance.popper, tippy, 'tippyInstance.popper');
    assert.strictEqual(
      tippyInstance.reference,
      trigger,
      'tippyInstance.reference'
    );

    assert.dom('[data-tippy-root]').hasAttribute('id', tippyId);
    let tippyBoxData = (find('[data-tippy-root] .tippy-box') as HTMLElement)
      .dataset;
    assert.strictEqual(tippyBoxData.state, 'visible');
    assert.strictEqual(tippyBoxData.placement, 'bottom-start');
    assert.strictEqual(
      (find('[data-tippy-root] .tippy-box .tippy-content') as HTMLElement)
        .dataset.state,
      'visible'
    );
    assert
      .dom('[data-tippy-root] .tippy-box .tippy-content')
      .containsText('Tooltip');
    assert.dom('[data-tippy-root] .tippy-box .tippy-arrow').doesNotExist();
  });

  test('it shows on hover', async function (assert) {
    const trigger = find('#trigger')!;
    await triggerEvent(trigger, 'mouseenter');

    assert.deepEqual(
      (find('[data-tippy-root] .tippy-box') as HTMLElement).dataset.state,
      'visible'
    );
  });

  test('it shows on focus', async function (assert) {
    const trigger = find('#trigger')!;
    await focus(trigger);

    assert.deepEqual(
      (find('[data-tippy-root] .tippy-box') as HTMLElement).dataset.state,
      'visible'
    );
  });

  test('it shows on touch', async function (assert) {
    const trigger = find('#trigger')!;
    await tap(trigger);

    assert.deepEqual(
      (find('[data-tippy-root] .tippy-box') as HTMLElement).dataset.state,
      'visible'
    );
  });

  test('it can render htmlSafe content', async function (assert) {
    this.set('content', htmlSafe('Tool<b id="b">tip</b>'));

    const trigger = find('#trigger')!;
    await focus(trigger);

    const tippyId = trigger.getAttribute('aria-describedby');
    assert.ok(tippyId, 'trigger has an attached tippy');

    const tippy = find('#' + tippyId)!;
    assert.ok(tippy, 'attached tippy found');

    assert.strictEqual(tippy.textContent, 'Tooltip');
    assert.strictEqual(find('#b')!.textContent, 'tip');
  });
});
