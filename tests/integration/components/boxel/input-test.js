import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

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
      hbs`
      <label for="input-test" class="boxel-sr-only">Pets</label>
      <Boxel::Input @id="input-test" @value="Puppies" @disabled={{true}} @required={{true}} />`
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
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it accepts input and can use the onInput action', async function (assert) {
    this.value = 'Hello world';
    this.inputAction = (value) => {
      this.set('value', `${value} with puppies`);
    };

    await render(
      hbs`<Boxel::Input @value={{this.value}} @onInput={{this.inputAction}} />`
    );
    assert.dom('[data-test-boxel-input]').hasValue('Hello world');

    await fillIn('[data-test-boxel-input]', 'Ice-cream');
    assert.dom('[data-test-boxel-input]').hasValue('Ice-cream with puppies');
  });

  test('it accepts input and can update using the input event', async function (assert) {
    this.value = 'Hello world';
    this.inputAction = (ev) => {
      this.set('value', `${ev.target.value} with puppies`);
    };

    await render(
      hbs`<Boxel::Input @value={{this.value}} {{on "input" this.inputAction}} />`
    );
    assert.dom('[data-test-boxel-input]').hasValue('Hello world');

    await fillIn('[data-test-boxel-input]', 'Ice-cream');
    assert.dom('[data-test-boxel-input]').hasValue('Ice-cream with puppies');
  });

  test('It adds appropriate aria and ids to input helper and error text', async function (assert) {
    await render(
      hbs`<Boxel::Input @invalid={{true}} @errorMessage="Error message" @helperText="Helper text" />`
    );

    const errorMessageId = this.element.querySelector(
      '[data-test-boxel-input-error-message]'
    ).id;
    const helperTextId = this.element.querySelector(
      '[data-test-boxel-input-helper-text]'
    ).id;

    assert
      .dom('[data-test-boxel-input]')
      .hasAria('errormessage', errorMessageId);
    assert.dom('[data-test-boxel-input]').hasAria('describedby', helperTextId);
  });

  test('It only shows the error message when there is one and the input state is invalid', async function (assert) {
    this.set('invalid', false);
    this.set('errorMessage', 'Error message');

    await render(
      hbs`<Boxel::Input @invalid={{this.invalid}} @errorMessage={{this.errorMessage}}/>`
    );

    assert.dom('[data-test-boxel-input]').doesNotHaveAria('invalid');
    assert.dom('[data-test-boxel-input]').doesNotHaveAria('errormessage');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

    this.set('invalid', true);

    const errorMessageId = this.element.querySelector(
      '[data-test-boxel-input-error-message]'
    ).id;

    assert.dom('[data-test-boxel-input]').hasAria('invalid', 'true');
    assert
      .dom('[data-test-boxel-input]')
      .hasAria('errormessage', errorMessageId);
    assert
      .dom('[data-test-boxel-input-error-message]')
      .containsText('Error message');

    this.set('errorMessage', '');

    assert.dom('[data-test-boxel-input]').hasAria('invalid', 'true');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    assert.dom('[data-test-boxel-input]').doesNotHaveAria('errormessage');
  });
});
