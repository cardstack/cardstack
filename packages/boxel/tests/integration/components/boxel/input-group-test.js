import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, fillIn } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { selectChoose } from 'ember-power-select/test-support';

module('Integration | Component | InputGroup', function (hooks) {
  setupRenderingTest(hooks);

  const INPUT_SELECTOR = '[data-test-boxel-input-group] input';

  test('it renders without accessories', async function (assert) {
    await render(hbs`<Boxel::InputGroup />`);
    assert.dom('[data-test-boxel-input-group]').exists();
    assert.dom(INPUT_SELECTOR).exists();
    assert.dom(INPUT_SELECTOR).isNotDisabled();
    assert.dom(INPUT_SELECTOR).isNotRequired();
  });

  test('it renders with a button accessory', async function (assert) {
    let isClicked = false;
    this.set('onClick', function () {
      isClicked = true;
    });
    await render(hbs`
      <Boxel::InputGroup>
        <:after as |Accessories|>
          <Accessories.Button {{on "click" this.onClick}}>Press Me</Accessories.Button>
        </:after>
      </Boxel::InputGroup>
    `);
    let buttonSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-button-accessory]';
    assert.dom(buttonSelector).exists();
    assert.dom(buttonSelector).containsText('Press Me');
    assert.dom(INPUT_SELECTOR).exists();
    await click(buttonSelector);
    assert.ok(isClicked);
  });

  test('it renders with an icon button accessory', async function (assert) {
    let isClicked = false;
    this.set('onClick', function () {
      isClicked = true;
    });
    await render(hbs`
      <Boxel::InputGroup>
        <:after as |Accessories|>
          <Accessories.IconButton
            @icon="gear"
            {{on "click" this.onClick}}
          />
        </:after>
      </Boxel::InputGroup>
    `);
    let buttonSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-icon-button-accessory]';
    assert.dom(buttonSelector).exists();
    assert.dom(`${buttonSelector} svg`).exists();
    assert.dom(INPUT_SELECTOR).exists();
    await click(buttonSelector);
    assert.ok(isClicked);
  });

  test('it renders with a select accessory', async function (assert) {
    let selectedOption;
    this.set('onChange', function (item) {
      selectedOption = item;
    });
    await render(hbs`
      <Boxel::InputGroup>
        <:after as |Accessories|>
          <Accessories.Select
            @onChange={{this.onChange}}
            @options={{array "Item 1" "Item 2" "Item 3"}}
          />
        </:after>
      </Boxel::InputGroup>
    `);
    let selectSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-select-accessory]';
    assert.dom(selectSelector).exists();
    assert.dom(INPUT_SELECTOR).exists();
    await selectChoose(selectSelector, 'Item 2');
    assert.deepEqual(selectedOption, 'Item 2');
  });

  test('it renders with a text accessory', async function (assert) {
    await render(hbs`
      <Boxel::InputGroup>
        <:before as |Accessories|>
          <Accessories.Text>Hello</Accessories.Text>
        </:before>
      </Boxel::InputGroup>
    `);
    let textSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-text-accessory]';
    assert.dom(textSelector).exists();
    assert.dom(textSelector).containsText('Hello');
    assert.dom(INPUT_SELECTOR).exists();
  });

  test('it renders with multiple accessories', async function (assert) {
    await render(hbs`
      <Boxel::InputGroup>
        <:before as |Accessories|>
          <Accessories.Text>Hello</Accessories.Text>
        </:before>
        <:after as |Accessories|>
          <Accessories.Button>Click Me</Accessories.Button>
          <Accessories.IconButton @icon="copy" />
        </:after>
      </Boxel::InputGroup>
    `);
    let textSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-text-accessory]';
    let buttonSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-button-accessory]';
    let iconButtonSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-icon-button-accessory]';
    assert.dom(textSelector).exists();
    assert.dom(textSelector).containsText('Hello');
    assert.dom(buttonSelector).exists();
    assert.dom(buttonSelector).containsText('Click Me');
    assert.dom(iconButtonSelector).exists();
    assert.dom(`${iconButtonSelector} svg`).exists();
    assert.dom(INPUT_SELECTOR).exists();
  });

  test('it yields info about the InputGroup', async function (assert) {
    await render(hbs`
      <Boxel::InputGroup>
        <:after as |Accessories inputGroup|>
          <Accessories.Text>{{inputGroup.elementId}}</Accessories.Text>
        </:after>
      </Boxel::InputGroup>
    `);
    let textSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-text-accessory]';
    assert.deepEqual(
      document.querySelector(INPUT_SELECTOR).getAttribute('id'),
      document.querySelector(textSelector).textContent
    );
  });

  test('it renders with arguments', async function (assert) {
    await render(
      hbs`
      <label for="input-test" class="boxel-sr-only">Pets</label>
      <Boxel::InputGroup @id="input-test" @value="Puppies" @disabled={{true}} @required={{true}}>
        <:before as |Accessories|>
          <Accessories.Text>Pets</Accessories.Text>
        </:before>
      </Boxel::InputGroup>
        `
    );
    assert
      .dom('[data-test-boxel-input-group] input[id="input-test"]')
      .exists('renders with id');
    assert
      .dom('[data-test-boxel-input-group] input[id="input-test"]')
      .hasValue('Puppies', 'renders value');
    assert
      .dom('[data-test-boxel-input-group] input[id="input-test"]')
      .isDisabled('can be disabled');
    assert
      .dom('[data-test-boxel-input-group] input[id="input-test"]')
      .isRequired('can be required');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it accepts input and uses the onInput action', async function (assert) {
    this.value = 'Hello world';
    this.inputAction = (value) => {
      this.set('value', `${value} with puppies`);
    };

    await render(
      hbs`
      <Boxel::InputGroup @value={{this.value}} @onInput={{this.inputAction}}>
        <:before as |Accessories|>
          <Accessories.Text>Pets</Accessories.Text>
        </:before>
      </Boxel::InputGroup>
      `
    );
    assert.dom(INPUT_SELECTOR).hasValue('Hello world');

    await fillIn(INPUT_SELECTOR, 'Ice-cream');
    assert.dom(INPUT_SELECTOR).hasValue('Ice-cream with puppies');
  });

  test('It adds appropriate aria and ids to input helper and error text', async function (assert) {
    await render(
      hbs`
      <Boxel::InputGroup @invalid={{true}} @errorMessage="Error message" @helperText="Helper text">
        <:before as |Accessories|>
          <Accessories.Text>Pets</Accessories.Text>
        </:before>
      </Boxel::InputGroup>
      `
    );
    const errorMessageId = this.element.querySelector(
      '[data-test-boxel-input-group-error-message]'
    ).id;
    const helperTextId = this.element.querySelector(
      '[data-test-boxel-input-group-helper-text]'
    ).id;

    assert.dom(INPUT_SELECTOR).hasAria('errormessage', errorMessageId);
    assert.dom(INPUT_SELECTOR).hasAria('describedby', helperTextId);
  });

  test('It only shows the error message when there is one and the input group state is invalid', async function (assert) {
    this.set('invalid', false);
    this.set('errorMessage', 'Error message');

    await render(
      hbs`
      <Boxel::InputGroup @invalid={{this.invalid}} @errorMessage={{this.errorMessage}}>
        <:before as |Accessories|>
          <Accessories.Text>Pets</Accessories.Text>
        </:before>
      </Boxel::InputGroup>
      `
    );

    assert.dom(INPUT_SELECTOR).doesNotHaveAria('invalid');
    assert.dom(INPUT_SELECTOR).doesNotHaveAria('errormessage');
    assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

    this.set('invalid', true);

    let errorMessageSelector = '[data-test-boxel-input-group-error-message]';
    const errorMessageId = this.element.querySelector(errorMessageSelector).id;

    assert.dom(INPUT_SELECTOR).hasAria('invalid', 'true');
    assert.dom(INPUT_SELECTOR).hasAria('errormessage', errorMessageId);
    assert.dom(errorMessageSelector).containsText('Error message');

    this.set('errorMessage', '');

    assert.dom(INPUT_SELECTOR).hasAria('invalid', 'true');
    assert.dom(errorMessageSelector).doesNotExist();
    assert.dom(INPUT_SELECTOR).doesNotHaveAria('errormessage');
  });

  test('providing a default block replaces the default input rendering', async function (assert) {
    await render(
      hbs`
      <Boxel::InputGroup @invalid={{this.invalid}} @errorMessage={{this.errorMessage}}>
        <:default as |Controls Accessories|>
          <Controls.Input @placeholder="Username" />
          <Accessories.Text>@</Accessories.Text>
          <Controls.Input @placeholder="Server" />
        </:default>
      </Boxel::InputGroup>
      `
    );
    assert.dom(INPUT_SELECTOR).exists({ count: 2 });
    let textSelector =
      '[data-test-boxel-input-group] [data-test-boxel-input-group-text-accessory]';
    assert.dom(textSelector).exists();
    assert.dom(textSelector).containsText('@');
  });
});
