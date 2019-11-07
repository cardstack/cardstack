import { module, test } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, triggerEvent, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').
      withAttributes({
        sourceType: '@cardstack/mock-auth',
        mayCreateUser: true,
        params: {
          users: {
            'sample-user': { verified: true }
          }
        }
      });
    factory.addResource('grants')
      .withAttributes({
        mayWriteFields: true,
        mayReadFields: true,
        mayCreateResource: true,
        mayReadResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayLogin: true
      })
      .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
  },

  destroy() {
    return [
      { type: 'cards', id: qualifiedCard1Id },
    ];
  }
});

module('Integration | Component | field-renderer', function(hooks) {
  setupRenderingTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function () {
    await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
  });

  test('it can select a field', async function(assert) {
    assert.expect(1);

    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test body' });
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
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
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);

    await render(hbs`<FieldRenderer @field={{field}} @mode="view"/>`);

    assert.dom('[data-test-string-field-viewer-label]').hasText('title:');
    assert.dom('[data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('input').doesNotExist();
    assert.dom('button').doesNotExist();
  });

  test('it renders field in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);
    this.set('noop', () => {});

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="edit"
      @setFieldValue={{action noop}}
    />
    `);

    assert.dom('[data-test-string-field-editor-label]').hasText('title:');
    assert.dom('input').hasValue('test title');
    assert.dom('button').doesNotExist
    assert.dom('.field-renderer-field-name-input').doesNotExist();
    assert.dom('.field-renderer--needed-when-embedded-chbx').doesNotExist();
  });

  test('it can update field value in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
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
    await triggerEvent('input', 'keyup');

    assert.dom('input').hasValue('updated title');
    assert.equal(field.value, 'updated title');
  });

  test('it renders field in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test body' });
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    this.set('field', field);
    this.set('noop', () => {});

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action noop}}
    />
    `);

    assert.dom('[data-test-field-renderer-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-field-renderer-label]').hasText('title');
    assert.dom('[data-test-field-renderer-value]').hasText('test title');
    assert.dom('[data-test-field-renderer-move-up-btn]').exists();
    assert.dom('[data-test-field-renderer-move-down-btn]').exists();
    assert.dom('[data-test-drop-zone="1"]').exists();

    assert.dom('.edit-title-field-value').doesNotExist();
    assert.dom('[data-test-string-field-viewer-value]').doesNotExist();
  });

  test('it can change field name in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setFieldName', (oldName, newName) => card.getField(oldName).setName(newName));

    await render(hbs`
    <FieldRenderer
      @isRightEdgeField={{true}}
      @field={{field}}
      @mode="schema"
      @setFieldName={{action setFieldName}}
      @setNeededWhenEmbedded={{action noop}}
      @schemaAttrs={{array "name" "label" "helper-text" "multiselect" "required" "embedded"}}
    />
    `);
    let input = '[data-test-schema-attr="name"] input';
    await fillIn(input, 'subtitle');
    await triggerEvent(input, 'keyup');

    assert.dom(input).hasValue('subtitle');
    assert.equal(field.name, 'subtitle');
  });

  test('it can change field needed-when-embedded in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setNeededWhenEmbedded', (fieldName, evt) => {
      evt.preventDefault();
      let { target: { checked } } = evt;
      card.getField(fieldName).setNeededWhenEmbedded(checked);
    });

    await render(hbs`
    <FieldRenderer
      @isRightEdgeField={{true}}
      @field={{field}}
      @mode="schema"
      @setFieldName={{action noop}}
      @setNeededWhenEmbedded={{action setNeededWhenEmbedded}}
      @schemaAttrs={{array "name" "label" "helper-text" "multiselect" "required" "embedded"}}
    />
    `);
    let input = '[data-test-schema-attr="embedded"] input';
    assert.dom(input).isChecked();
    await click(input);

    assert.dom(input).isNotChecked();
    assert.equal(field.neededWhenEmbedded, false);
  });

  test('it can change field position in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test body' });
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('setPosition', (fieldName, position) => card.moveField(card.getField(fieldName), position));

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action setPosition}}
      @removeField={{action noop}}
    />
    `);

    assert.equal(field.position, 1);

    await click(`[data-test-field="title"] [data-test-field-renderer-move-up-btn]`);
    assert.equal(field.position, 0);

    await click(`[data-test-field="title"] [data-test-field-renderer-move-down-btn]`);
    assert.equal(field.position, 1);

    await click(`[data-test-field="title"] [data-test-field-renderer-move-down-btn]`);
    assert.equal(field.position, 2);
  });

  test('it can remove a field in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('removeField', fieldName => card.getField(fieldName).remove());

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action noop}}
      @setFieldName={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action removeField}}
    />
    `);

    await click('[data-test-field-renderer-remove-btn]');

    assert.notOk(card.getField('title'), 'field does not exist on card');
  });

  test('it can perform an action when an item is dropped into the drop zone', async function(assert) {
    assert.expect(2);

    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    this.set('field', field);
    this.set('noop', () => {});
    this.set('dropField', (position, callback) => {
      assert.equal(position, 0);
      assert.equal(typeof callback, 'function');
    });

    await render(hbs`
    <FieldRenderer
      @field={{field}}
      @mode="schema"
      @dropField={{action dropField}}
      @setFieldName={{action noop}}
      @setNeededWhenEmbedded={{action noop}}
      @setPosition={{action noop}}
      @removeField={{action noop}}
    />
    `);

    await triggerEvent(`[data-test-drop-zone="0"]`, 'drop');
  });
});
