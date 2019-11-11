import { module, test } from 'qunit';
import { click, fillIn, find, visit, currentURL, waitFor, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, setCardId, createCards, dragAndDropNewField, removeField } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const timeout = 5000;
const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: qualifiedCard1Id },
    ];
  }
});

module('Acceptance | card create', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function () {
    this.owner.lookup('service:data')._clearCache();
  });

  test('new cards get a default id', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await click('[data-test-card-creator-save-btn]');
    await waitFor('[data-test-card-view^="new-card-"]', { timeout });

    assert.ok(currentURL().match(/\/cards\/new-card-[0-9]+/));
  });

  test('creating a card', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await createCards({
      [card1Id]: [
        ['title', 'string', true],
        ['body', 'string', false],
        ['author', 'related card', true],
        ['reviewers', 'related cards', true]
      ]
    });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    await visit(`/cards/${card1Id}/schema`);

    await click('[data-test-field="title"]');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-field="body"]');
    assert.dom('[data-test-field="body"] [data-test-field-renderer-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await click('[data-test-field="author"]');
    assert.dom('[data-test-field="author"] [data-test-field-renderer-type]').hasText('@cardstack/core-types::belongs-to');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-field="reviewers"]');
    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-type]').hasText('@cardstack/core-types::has-many');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.deepEqual(card.data.relationships.reviewers.data, []);
  });

  test(`selecting a field`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false);

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
    await click('[data-test-field="new-field-2"]');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('new-field-2');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('new-field-2');
  });

  test(`multiselect button appears for relationship fields`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await dragAndDropNewField('string');
    assert.dom('[data-test-schema-attr="multiselect"]').doesNotExist();

    await dragAndDropNewField('related card');
    assert.dom('[data-test-schema-attr="multiselect"]').exists();

    await dragAndDropNewField('related cards');
    assert.dom('[data-test-schema-attr="multiselect"]').exists();
  });

  test(`renaming a card's field`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-label]').hasText('subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-editor-label]').hasText('subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/schema`);
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('subtitle');
    await click('[data-test-field="subtitle"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');
  });

  test(`removing a field from a card`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);

    await removeField('title');

    assert.dom('.cardhost-right-edge-panel [data-test-field]').doesNotExist();
  });

  test('can add a field at a particular position', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false, 1);
    await addField('author', 'string', false, 1);

    assert.deepEqual([...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.deepEqual([...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);
    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'title' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'body' },
    ]);
  });
});
