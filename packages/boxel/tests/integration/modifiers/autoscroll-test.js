import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitUntil } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
function delay(delayAmountMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayAmountMs);
  });
}
module('Integration | Modifiers | autoscroll', function (hooks) {
  setupRenderingTest(hooks);

  test('it scrolls down when at bottom', async function (assert) {
    this.set('blocks', [{}]);
    await render(hbs`
      {{!-- template-lint-disable no-inline-styles --}}
      <div
        class="scroll-div"
        style="max-height:300px;overflow-y:auto"
        {{autoscroll lockThreshold=10}}
      >
        {{#each this.blocks as |block index|}}
          <div style="height:100px;border:1px solid blue">Element {{index}}</div>
        {{/each}}
      </div>
    `);
    let scrollEl = this.element.querySelector('.scroll-div');

    assert.equal(scrollEl.scrollTop, 0);

    this.set('blocks', [{}, {}, {}, {}]);
    await waitUntil(() => scrollEl.scrollTop === 100);
    assert.equal(
      scrollEl.scrollTop,
      100,
      'autoscrolls when scrolled to bottom'
    );

    scrollEl.scrollTo(0, 95);
    this.set('blocks', [{}, {}, {}, {}, {}]);
    await waitUntil(() => scrollEl.scrollTop === 200);
    assert.equal(
      scrollEl.scrollTop,
      200,
      'autoscrolls when scrolled near bottom'
    );

    scrollEl.scrollTo(0, 150);
    await delay(100);
    this.set('blocks', [{}, {}, {}, {}, {}, {}]);
    await delay(100);
    assert.equal(
      scrollEl.scrollTop,
      150,
      'does not autoscroll when not scrolled near bottom'
    );

    scrollEl.scrollTo(0, 300);
    await delay(100);
    this.set('blocks', [{}, {}, {}, {}, {}, {}, {}]);
    await waitUntil(() => scrollEl.scrollTop === 400);
    assert.equal(
      scrollEl.scrollTop,
      400,
      'autoscrolls when scrolled to bottom again'
    );
  });
});
