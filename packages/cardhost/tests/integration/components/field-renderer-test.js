import { module, test } from 'qunit';
import Fixtures from '../../helpers/fixtures';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const card1Id = 'millenial-puppies';
const card2Id = 'genx-kittens';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const qualifiedCard2Id = `local-hub::${card2Id}`;

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').withAttributes({
      sourceType: '@cardstack/mock-auth',
      mayCreateUser: true,
      params: {
        users: {
          'sample-user': { verified: true },
        },
      },
    });
    factory
      .addResource('grants')
      .withAttributes({
        mayWriteFields: true,
        mayReadFields: true,
        mayCreateResource: true,
        mayReadResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayLogin: true,
      })
      .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
  },

  destroy() {
    return [
      { type: 'cards', id: qualifiedCard2Id },
      { type: 'cards', id: qualifiedCard1Id },
    ];
  },
});

module('Integration | Component | field-renderer', function(hooks) {
  setupRenderingTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner
      .lookup('service:mock-login')
      .get('login')
      .perform('sample-user');
  });

  test('it can select a field', async function(assert) {
    assert.expect(1);

    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test body',
    });
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('selectField', field => {
      assert.equal(field.name, 'title');
    });

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="view"
      @selectField={{action selectField}}
    />
    `);

    await click('[data-test-field="title"]');
  });

  test('it renders field in view mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      label: 'Field Title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
      instructions: 'field instructions',
    });
    this.set('field', field);

    await render(hbs`<FieldRenderer @field={{field}} @mode="view"/>`);

    assert.dom('[data-test-field-mode="view"][data-test-field="title"]').exists();
    assert
      .dom('[data-test-field="title"].field.title-field.field-type-text-view-field.field-type-string-view-field')
      .exists();
    assert.dom('[data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-string-field-viewer-label]').hasText('Field Title');
    assert.dom('[data-test-field="title"]').doesNotContainText('field instructions');
    assert.dom('input').doesNotExist();
    assert.dom('button').doesNotExist();
    assert.dom('[data-test-string-field-viewer-label].label.title-label').exists();
    assert.dom('[data-test-string-field-viewer-value].value.title-value').exists();
  });

  test('it renders field in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
      instructions: 'test instructions',
    });
    this.set('field', field);
    this.set('noop', () => {});

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="edit"
      @setFieldValue={{action noop}}
    />
    `);

    assert.dom('[data-test-field-mode="edit"][data-test-field="title"]').exists();
    assert
      .dom('[data-test-field="title"].field.title-field.field-type-text-edit-field.field-type-string-edit-field')
      .exists();
    assert.dom('[data-test-field-mode="edit"][data-test-field="title"] label').hasText('title');
    assert.dom('[data-test-field-mode="edit"][data-test-field="title"] input').hasValue('test title');
    assert
      .dom('[data-test-field-mode="edit"][data-test-field="title"] [data-test-cs-component-validation]')
      .hasText('test instructions');
    assert.dom('button').doesNotExist;
    assert.dom('[data-test-field-mode="schema"]').doesNotExist();
    assert.dom('[data-test-field-mode="view"]').doesNotExist();
  });

  test('it can update field value in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('setFieldValue', value => field.setValue(value));

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="edit"
      @setFieldValue={{action setFieldValue}}
    />
    `);

    await fillIn('input', 'updated title');

    assert.dom('input').hasValue('updated title');
    assert.equal(field.value, 'updated title');
  });

  test('it renders field in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test body',
    });
    let field = card.addField({
      name: 'title',
      label: 'Article Title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    this.set('field', field);
    this.set('noop', () => {});

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setFieldLabel={{action noop}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action noop}}
      @schemaAttrs={{array "title" "type" "label" "name" "instructions" "is-meta" "embedded" "required"}}
    />
    `);

    assert.dom('[data-test-field-mode="schema"][data-test-field="title"]').exists();
    assert
      .dom('[data-test-field="title"].field.title-field.field-type-text-schema-field.field-type-string-schema-field')
      .exists();
    assert.dom('[data-test-field-schema-renderer] [data-test-field-renderer-type]').hasText('title (Text)');
    assert
      .dom('[data-test-field-schema-renderer] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/assets/images/field-types/text-field-icon.svg")');
    assert.dom('[data-test-field-schema-renderer] [data-test-field-renderer-label]').hasText('Article Title');
    assert.dom('[data-test-field-schema-renderer] [data-test-field-renderer-value]').hasText('test title');
    assert.dom('.schema-field-renderer--header--detail').doesNotExist();
    assert.dom('[data-test-field-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-field-renderer-move-btn]').exists();

    assert.dom('.edit-title-field-value').doesNotExist();
    assert.dom('[data-test-string-field-viewer-value]').doesNotExist();

    assert.dom('[data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-schema-attr="name"] input').isNotDisabled();
    assert.dom('[data-test-schema-attr="label"] input').hasValue('Article Title');
    assert.dom('[data-test-schema-attr="label"] input').isNotDisabled();
    assert.dom('[data-test-schema-attr="instructions"] textarea').isNotDisabled();
    assert.dom('[data-test-schema-attr="embedded"] input').isChecked();
    assert.dom('[data-test-schema-attr="embedded"] input').isNotDisabled();
  });

  test('it can render an adopted field in schema mode', async function(assert) {
    // name, label, and needed-when-embedded should be disabled
    // instructions and required should be enabled

    let service = this.owner.lookup('service:data');
    let parent = service.createCard(qualifiedCard1Id);
    parent.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
    parent.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
    parent.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
    await parent.save();

    let card = service.createCard(qualifiedCard2Id, parent);
    let field = card.getField('title');
    field.setValue('test title');
    this.set('field', field);
    this.set('noop', () => {});

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setFieldLabel={{action noop}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action noop}}
      @schemaAttrs={{array "title" "type" "label" "name" "instructions" "is-meta" "embedded" "required"}}
    />
    `);

    assert.dom('[data-test-field-mode="schema"][data-test-field="title"]').exists();
    assert
      .dom('[data-test-field="title"].field.title-field.field-type-text-schema-field.field-type-string-schema-field')
      .exists();
    assert.dom('.schema-field-renderer--header--detail').hasText('Adopted');
    assert.dom('[data-test-field-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-field-renderer-move-btn]').exists();

    assert.dom('.edit-title-field-value').doesNotExist();
    assert.dom('[data-test-string-field-viewer-value]').doesNotExist();

    assert.dom('[data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-schema-attr="name"] input').isDisabled();
    assert.dom('[data-test-schema-attr="label"] input').hasValue('title');
    assert.dom('[data-test-schema-attr="label"] input').isDisabled();
    assert.dom('[data-test-schema-attr="instructions"] textarea').isNotDisabled();
    assert.dom('[data-test-schema-attr="embedded"] input').isChecked();
    assert.dom('[data-test-schema-attr="embedded"] input').isDisabled();
  });

  test('it can change field name in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setFieldName', (oldName, newName) => card.getField(oldName).setName(newName));
    this.set('setFieldLabel', (fieldName, newName) => card.getField(fieldName).setLabel(newName));

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @setFieldName={{action setFieldName}}
      @setFieldLabel={{action setFieldLabel}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @schemaAttrs={{array "name" "label" "instructions" "required" "embedded"}}
    />
    `);
    let nameInput = '[data-test-schema-attr="name"] input';
    let labelInput = '[data-test-schema-attr="label"] input';
    await fillIn(nameInput, 'subtitle');

    assert.dom(nameInput).hasValue('subtitle');
    assert.dom(labelInput).hasValue('Subtitle');
    assert.equal(field.name, 'subtitle');
    assert.equal(field.label, 'Subtitle');
  });

  test('it can change field label in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setFieldName', (oldName, newName) => card.getField(oldName).setName(newName));
    this.set('setFieldLabel', (fieldName, newName) => card.getField(fieldName).setLabel(newName));

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @setFieldName={{action setFieldName}}
      @setFieldLabel={{action setFieldLabel}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @schemaAttrs={{array "name" "label" "instructions" "required" "embedded"}}
    />
    `);
    let nameInput = '[data-test-schema-attr="name"] input';
    let labelInput = '[data-test-schema-attr="label"] input';
    await fillIn(labelInput, 'TITLE');

    assert.dom(nameInput).hasValue('title');
    assert.dom(labelInput).hasValue('TITLE');
    assert.equal(field.name, 'title');
    assert.equal(field.label, 'TITLE');
  });

  test('it can change field instructions in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      instructions: 'test instructions',
    });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setFieldInstructions', (fieldName, instructions) =>
      card.getField(fieldName).setInstructions(instructions)
    );

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @setFieldName={{action noop}}
      @setFieldLabel={{action noop}}
      @setFieldInstructions={{action setFieldInstructions}}
      @setNeededWhenEmbedded={{action noop}}
      @schemaAttrs={{array "name" "label" "instructions" "required" "embedded"}}
    />
    `);
    let input = '[data-test-schema-attr="instructions"] textarea';
    await fillIn(input, 'updated instructions');

    assert.dom(input).hasValue('updated instructions');
    assert.equal(field.instructions, 'updated instructions');
  });

  test('it can change field needed-when-embedded in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setNeededWhenEmbedded', (fieldName, checked, evt) => {
      evt.preventDefault();
      card.getField(fieldName).setNeededWhenEmbedded(checked);
    });

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @setFieldName={{action noop}}
      @setFieldLabel={{action noop}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action setNeededWhenEmbedded}}
      @schemaAttrs={{array "name" "label" "instructions" "required" "embedded"}}
    />
    `);
    let input = '[data-test-schema-attr="embedded"] input';
    assert.dom(input).isChecked();
    await click(input);

    assert.dom(input).isNotChecked();
    assert.equal(field.neededWhenEmbedded, false);
  });

  test('it can remove a field in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('removeField', fieldNonce => card.getFieldByNonce(fieldNonce).remove());

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setFieldLabel={{action noop}}
      @setFieldInstructions={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action removeField}}
    />
    `);

    await click('[data-test-field-renderer-remove-btn]');

    assert.notOk(card.getField('title'), 'field does not exist on card');
  });
});
