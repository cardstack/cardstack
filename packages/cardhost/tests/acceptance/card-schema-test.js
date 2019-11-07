import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor, fillIn, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, createCards, removeField, dragAndDropField } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const timeout = 5000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  }
});

module('Acceptance | card schema', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function () {
    this.owner.lookup('service:data')._clearCache();
  });

  test(`adding a new field to a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/schema`);

    await addField('title', 'string', true);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    await visit(`/cards/${card1Id}/schema`);

    await click('[data-test-field="title"]');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, undefined);
  });

  test(`renaming a card's field`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title']
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/schema`);

    assert.dom('[data-test-field="title"] [data-test-field-renderer-label]').hasText('title');
    await click('[data-test-field="title"]');
    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="name"] input', 'keyup');

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    await visit(`/cards/${card1Id}/schema`);

    assert.dom('[data-test-field="title"]').doesNotExist();

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.subtitle, 'test title');
    assert.equal(card.data.attributes.title, undefined);

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/schema`);
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('subtitle');
  });


  test(`removing a field from a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/schema`);

    await removeField('body');

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.dom('[data-test-field="body"]').doesNotExist();
    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.body, undefined);

    assert.dom('[data-test-right-edge] [data-test-field]').doesNotExist();
  });

  test(`move a field's position`, async function (assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
        ['author', 'string', false, 'test author'],
        ['body', 'string', false, 'test body'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);

    assert.deepEqual([...document.querySelectorAll('.isolated-card [data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);

    await click('[data-test-field="title"] [data-test-field-renderer-move-down-btn]');
    assert.deepEqual([...document.querySelectorAll('.isolated-card [data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['author', 'title', 'body']);

    await click('[data-test-field="title"] [data-test-field-renderer-move-down-btn]');
    assert.deepEqual([...document.querySelectorAll('.isolated-card [data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['author', 'body', 'title']);

    await click('[data-test-field="body"] [data-test-field-renderer-move-up-btn]');
    assert.deepEqual([...document.querySelectorAll('.isolated-card [data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['body', 'author', 'title']);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.deepEqual([...document.querySelectorAll('.isolated-card [data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['body', 'author', 'title']);
    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'body' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'title' },
    ]);
  });

  test(`selecting a field`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
        ['author', 'string', false, 'test author'],
        ['body', 'string', false, 'test body'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="name"] input`, 'keyup');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'Subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="label"] input`, 'keyup');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await click('[data-test-field="body"]');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('body');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('body');

    await click('[data-test-field="subtitle"]');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await dragAndDropField('string');
    await click('[data-test-field="new-field-3"]');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('new-field-3');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('new-field-3');
  });

  test(`change a field's needed-when-embedded value to true`, async function (assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await click('[data-test-right-edge] [data-test-schema-attr="embedded"] input');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();
    let card = JSON.parse(find('.code-block').textContent);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], true);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();
    card = JSON.parse(find('.code-block').textContent);
    field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], true);
  });

  test(`change a field's needed-when-embedded value to false`, async function (assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', true, 'test title'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-right-edge] [data-test-schema-attr="embedded"] input');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();
    let card = JSON.parse(find('.code-block').textContent);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    await visit(`/cards/${card1Id}/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();
    card = JSON.parse(find('.code-block').textContent);
    field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);
  });

  test(`can navigate to card editor`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    await fillIn('[data-test-mode-switcher]', 'edit');
    await waitFor(`[data-test-card-edit="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
    assert.dom(`[data-test-card-edit="${card1Id}"]`).exists();
  });

  test(`can navigate to card view`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    await fillIn('[data-test-mode-switcher]', 'view');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom(`[data-test-card-view="${card1Id}"]`).exists();
  });
});
