import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor, fillIn, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, createCards, removeField, dragAndDropNewField, dragFieldToNewPosition } from '@cardstack/test-support/card-ui-helpers';
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
    await fillIn('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea', 'fill this in with your subheader');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea').hasValue('fill this in with your subheader');

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });
    await visit(`/cards/${card1Id}/schema`);

    assert.dom('[data-test-field="title"]').doesNotExist();

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.subtitle, 'test title');
    assert.equal(card.data.attributes["metadata-summary"].subtitle.instructions, 'fill this in with your subheader');
    assert.equal(card.data.attributes.title, undefined);

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-label]').hasText('subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit`);
    assert.dom('[data-test-field="subtitle"] input').hasValue('test title');
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-editor-label]').hasText('subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/schema`);
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('subtitle');
    await click('[data-test-field="subtitle"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');
  });

  test(`changing the label for a field`, async function(assert) {
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
    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'TITLE');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="label"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-label]').hasText('TITLE');

    await visit(`/cards/${card1Id}/edit`);
    assert.dom('[data-test-field="title"] input').hasValue('test title');
    assert.dom('[data-test-field="title"] [data-test-string-field-editor-label]').hasText('TITLE');

    await visit(`/cards/${card1Id}/schema`);
    assert.dom('[data-test-field="title"] [data-test-field-renderer-label]').hasText('title');
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');
  })

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

  test(`move a field's position via drag & drop`, async function (assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
        ['author', 'string', false, 'test author'],
        ['body', 'string', false, 'test body'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);
    assert.deepEqual([...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);

    await dragFieldToNewPosition(0, 1);
    assert.deepEqual([...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
    ['author', 'title', 'body']);

    await dragFieldToNewPosition(1, 2);
    assert.deepEqual([...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
    ['author', 'body', 'title']);

    await dragFieldToNewPosition(1, 0);
    assert.deepEqual([...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['body', 'author', 'title']);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.deepEqual([...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
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

    await dragAndDropNewField('string');
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
