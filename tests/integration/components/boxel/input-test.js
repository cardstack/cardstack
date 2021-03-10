import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | Input', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Input />`);
    assert.dom('[data-test-boxel-input]').exists();
    assert.dom('[data-test-boxel-input]').isNotDisabled();
    assert.dom('[data-test-boxel-input]').isNotRequired();
  });

  test('it renders with arguments', async function (assert) {
    await render(
      hbs`<Boxel::Input @id="input-test" @value="Puppies" @disabled={{true}} @required={{true}} />`
    );
    assert
      .dom('[data-test-boxel-input-id="input-test"]')
      .exists('renders with id');
    assert
      .dom('[data-test-boxel-input-id="input-test"]')
      .hasValue('Puppies', 'renders value');
    assert
      .dom('[data-test-boxel-input-id="input-test"]')
      .isDisabled('can be disabled');
    assert
      .dom('[data-test-boxel-input-id="input-test"]')
      .isRequired('can be required');
  });

  test('it accepts input', async function (assert) {
    await render(hbs`<Boxel::Input />`);
    assert.dom('[data-test-boxel-input]').hasNoValue();

    await fillIn('[data-test-boxel-input]', 'Puppies');
    assert.dom('[data-test-boxel-input]').hasValue('Puppies');
  });

  test('it can run custom onInput action', async function (assert) {
    this.value = 'Hello world';
    this.inputAction = (ev) => {
      this.set('value', `${ev.target.value} with puppies`);
    };

    await render(
      hbs`<Boxel::Input @value={{this.value}} @onInput={{this.inputAction}} />`
    );
    assert.dom('[data-test-boxel-input]').hasValue('Hello world');

    await fillIn('[data-test-boxel-input]', 'Ice-cream');
    assert.dom('[data-test-boxel-input]').hasValue('Ice-cream with puppies');
  });
});
