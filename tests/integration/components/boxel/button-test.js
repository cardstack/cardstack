import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

const BUTTON_SELECTOR = '[data-test-boxel-button]';
const DROPDOWN_BUTTON_SELECTOR = '[data-test-boxel-dropdown-button]';

module('Integration | Component | Button', function (hooks) {
  setupRenderingTest(hooks);

  test('It renders with the correct text contents', async function (assert) {
    await render(hbs`<Boxel::Button>A button</Boxel::Button>`);
    assert.dom(BUTTON_SELECTOR).hasText('A button');
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
      hbs`<Boxel::Button {{ on 'click' this.onClick}}>A button</Boxel::Button>`
    );
    await click(BUTTON_SELECTOR);
    assert.equal(clicked, true);
  });

  test('It can be disabled via html attribute', async function (assert) {
    await render(hbs`<Boxel::Button disabled>A button</Boxel::Button>`);
    assert.dom(BUTTON_SELECTOR).isDisabled();
  });

  test('It can be disabled via argument', async function (assert) {
    await render(
      hbs`<Boxel::Button @disabled={{true}}>A button</Boxel::Button>`
    );
    assert.dom(BUTTON_SELECTOR).isDisabled();
  });

  test('It can apply appropriate styles depending on arguments', async function (assert) {
    this.setProperties({
      primary: true,
      dropdownIcon: true,
      collectionStyle: true,
    });

    await render(
      hbs`<Boxel::Button 
            @primary={{this.primary}} 
            @dropdownIcon={{this.dropdownIcon}} 
            @collectionStyle={{this.collectionStyle}}
          >
          A button
          </Boxel::Button>`
    );

    assert
      .dom(BUTTON_SELECTOR)
      .hasClass(/--primary/)
      .hasClass(/--dropdown/)
      .hasClass(/--collection-style/);

    this.setProperties({
      primary: false,
      dropdownIcon: false,
      collectionStyle: false,
    });
    assert
      .dom(BUTTON_SELECTOR)
      .doesNotHaveClass(/--primary/)
      .doesNotHaveClass(/--dropdown/)
      .doesNotHaveClass(/--collection-style/);
  });

  test('It can include a dropdown button', async function (assert) {
    this.set('menuComponent', 'boxel/menu');
    await render(hbs`
          <Boxel::Button as |b|>
              A button
              <b.MoreButton />
          </Boxel::Button>
      `);
    assert.dom(DROPDOWN_BUTTON_SELECTOR).exists();
    // am not testing ember-basic-dropdown functionality here
    // their tests seem to use a form of mock dropdown
  });
});
