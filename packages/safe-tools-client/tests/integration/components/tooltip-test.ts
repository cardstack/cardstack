/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { render, triggerEvent, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';
import { setupRenderingTest } from '../../helpers';

module('Integration | Component | Tooltip', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders a tooltip that triggers on hover', async function (assert) {
    await render(hbs`
        <div style="margin-top: 100px">
          <Tooltip>
            <:trigger>
              Hover over me
            </:trigger>
            <:content>
              I am a tooltip
            </:content>
          </Tooltip>
        </div>
      `);

    assert.dom('[data-test-tooltip-trigger]').hasText('Hover over me');
    assert.dom('[data-test-tooltip-content]').hasText('I am a tooltip');

    assert
      .dom('[data-test-tooltip-content]')
      .hasStyle({ visibility: 'hidden' });

    assert.true(
      parseInt(
        window.getComputedStyle(
          document.querySelector('[data-test-tooltip-content]')!
        ).opacity
      ) > 0
    );
  });
});
