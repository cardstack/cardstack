/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { render, triggerEvent } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

module('Integration | Component | Tooltip', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders a tooltip that triggers on hover', async function (assert) {
    await render(hbs`
        <Tooltip>
          <:trigger>
            Hover over me
          </:trigger>
          <:content>
            I am a tooltip
          </:content>
        </Tooltip>
      `);

    assert.dom('[data-test-tooltip-trigger]').hasText('Hover over me');
    assert.dom('[data-test-tooltip-content]').hasText('I am a tooltip');

    // Tooltip content should be hidden by default
    assert.dom('[data-test-tooltip-content-is-shown="false"]').exists();

    // Tooltip content should reveal on trigger hover
    await triggerEvent('[data-test-tooltip-trigger]', 'mouseenter');
    assert.dom('[data-test-tooltip-content-is-shown=true]').exists();

    await triggerEvent('[data-test-tooltip-trigger]', 'mouseleave');
    await triggerEvent('[data-test-tooltip-content]', 'mouseenter');

    // The tooltip should still be visible after the user quickly moves the mouse from the trigger to the content
    assert.dom('[data-test-tooltip-content-is-shown=true]').exists();

    // When the mouse cursor leaves the tooltip content, the tooltip should hide after a short delay
    await triggerEvent('[data-test-tooltip]', 'mouseleave');

    await new Promise((r) => setTimeout(r, 5)); // Wait for the tooltip to hide (5 ms is enough for the test)
    assert.dom('[data-test-tooltip-content-is-shown=false]').exists();
  });
});
