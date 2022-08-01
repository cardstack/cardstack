import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

const BUTTON_SELECTOR = '[data-test-boxel-button]';
const LOADING_INDICATOR_SELECTOR = '[data-test-boxel-button-loading-indicator]';

module('Integration | Component | Button', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders with the correct text contents', async function (assert) {
    await render(hbs`<Boxel::Button>A button</Boxel::Button>`);
    assert.dom(BUTTON_SELECTOR).hasText('A button');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It renders with the correct html inside', async function (assert) {
    await render(
      hbs`<Boxel::Button><span class="test-span">Testing!</span></Boxel::Button>`
    );
    assert.dom(`${BUTTON_SELECTOR} span.test-span`).exists();
  });

  test('It can be clicked and call a callback', async function (assert) {
    let clicked = false;
    this.set('onClick', () => {
      clicked = true;
    });
    await render(
      hbs`<Boxel::Button {{ on "click" this.onClick }}>A button</Boxel::Button>`
    );
    await click(BUTTON_SELECTOR);
    assert.true(clicked);
  });

  test('It can be disabled via html attribute', async function (assert) {
    await render(hbs`<Boxel::Button disabled>A button</Boxel::Button>`);
    assert.dom(BUTTON_SELECTOR).isDisabled();

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It can be disabled via argument', async function (assert) {
    await render(
      hbs`<Boxel::Button @disabled={{ true }}>A button</Boxel::Button>`
    );
    assert.dom(BUTTON_SELECTOR).isDisabled();

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It can apply appropriate classes depending on the kind argument', async function (assert) {
    const kinds = ['primary', 'dropdown'];
    const kindClassRegexes = kinds.map((v) => new RegExp('--kind-' + v));

    this.setProperties({
      kind: kinds[0],
    });

    await render(
      hbs`<Boxel::Button @kind={{ this.kind }}>
          A button
          </Boxel::Button>`
    );

    for (let i = 0; i < kindClassRegexes.length; i++) {
      this.setProperties({
        kind: kinds[i],
      });
      for (let j = 0; j < kindClassRegexes.length; j++) {
        if (j === i) assert.dom(BUTTON_SELECTOR).hasClass(kindClassRegexes[j]);
        else assert.dom(BUTTON_SELECTOR).doesNotHaveClass(kindClassRegexes[j]);
      }
    }

    // check that there is a default value set
    this.set('kind', '');
    assert.dom(BUTTON_SELECTOR).hasClass(/--kind-secondary-light/);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('It can apply appropriate classes depending on the size argument', async function (assert) {
    const sizes = ['small', 'base', 'tall', 'touch'];
    const sizeClassRegexes = sizes.map((v) => new RegExp('--size-' + v));

    this.setProperties({
      size: sizes[0],
    });

    await render(
      hbs`<Boxel::Button @size={{ this.size }}>
          A button
          </Boxel::Button>`
    );

    for (let i = 0; i < sizeClassRegexes.length; i++) {
      this.setProperties({
        size: sizes[i],
      });
      for (let j = 0; j < sizeClassRegexes.length; j++) {
        if (j === i) assert.dom(BUTTON_SELECTOR).hasClass(sizeClassRegexes[j]);
        else assert.dom(BUTTON_SELECTOR).doesNotHaveClass(sizeClassRegexes[j]);
      }
    }

    // check that there is a default value set
    this.set('size', '');
    assert.dom(BUTTON_SELECTOR).hasClass(/--size-base/);
  });

  test('It can render as both anchor and link-to depending on @as', async function (assert) {
    this.set('as', 'anchor');
    this.set('href', '#');
    await render(
      hbs`<Boxel::Button @as={{ this.as }} @href={{ this.href }}>
          This should be an anchor
          </Boxel::Button>`
    );
    assert.dom(`a${BUTTON_SELECTOR}`).hasAttribute('href', '#');
    assert.dom(`button${BUTTON_SELECTOR}`).doesNotExist();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    this.set('as', '');
    assert.dom(`a${BUTTON_SELECTOR}`).doesNotExist();
    assert.dom(`button${BUTTON_SELECTOR}`).doesNotHaveAttribute('href');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');

    this.set('as', 'link-to');
    assert.dom(`a${BUTTON_SELECTOR}`).exists();
    assert.dom(`button${BUTTON_SELECTOR}`).doesNotExist();
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('An anchor element button should be able to receive event listeners', async function (assert) {
    this.set('href', '#');
    let clicked = false;
    this.set('onClick', () => {
      clicked = true;
    });
    await render(hbs`
      <Boxel::Button @as="anchor" @href={{ this.href }} {{ on "click" this.onClick }}>
        An anchor
      </Boxel::Button>
    `);
    await click(BUTTON_SELECTOR);
    assert.true(clicked);
  });

  test('When @loading is true, it displays the loading indicator on buttons and not anchors', async function (assert) {
    this.set('as', 'button');
    this.set('loading', false);
    await render(hbs`
      <Boxel::Button @as={{this.as}} @loading={{this.loading}}>
        A loading button
      </Boxel::Button>
    `);
    assert.dom(LOADING_INDICATOR_SELECTOR).doesNotExist();
    this.set('loading', true);
    assert.dom(LOADING_INDICATOR_SELECTOR).isVisible();
    this.set('as', 'anchor');
    assert.dom(LOADING_INDICATOR_SELECTOR).doesNotExist();
  });

  // we can't test for disabled links because programmatic clicks bypass pointer-events:none
});
