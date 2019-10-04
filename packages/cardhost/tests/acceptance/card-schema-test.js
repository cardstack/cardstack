import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, createCards, removeField } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const card1Id = 'local-hub::article-card::millenial-puppies';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: card1Id }];
  }
});

module('Acceptance | card schema', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

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
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-value]').hasText('<no value>')
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, undefined);
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

    assert.dom('[data-test-card-renderer-field="body"]').doesNotExist();
    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.body, undefined);
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

    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['title', 'author', 'body']);

    await click('[data-test-card-renderer-field="title"] [data-test-card-renderer-move-down-btn');
    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['author', 'title', 'body']);

    await click('[data-test-card-renderer-field="title"] [data-test-card-renderer-move-down-btn');
    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['author', 'body', 'title']);

    await click('[data-test-card-renderer-field="body"] [data-test-card-renderer-move-up-btn');
    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['body', 'author', 'title']);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['body', 'author', 'title']);
    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'body' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'title' },
    ]);
  });

  test(`change a field's needed-when-embedded value to true`, async function (assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
      ]
    });
    await visit(`/cards/${card1Id}/schema`);

    assert.dom('#edit_title_embedded').isNotChecked();

    await click('#edit_title_embedded');
    assert.dom('#edit_title_embedded').isChecked();
    let card = JSON.parse(find('.code-block').textContent);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], true);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');
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

    assert.dom('#edit_title_embedded').isChecked();

    await click('#edit_title_embedded');
    assert.dom('#edit_title_embedded').isNotChecked();
    let card = JSON.parse(find('.code-block').textContent);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);

    await click('[data-test-card-schema-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('false');
    card = JSON.parse(find('.code-block').textContent);
    field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);
  });
});
