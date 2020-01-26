import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor, fillIn, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  createCards,
  saveCard,
  removeField,
  dragAndDropNewField,
  dragFieldToNewPosition,
} from '../helpers/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { animationsSettled } from 'ember-animated/test-support';

const card1Id = 'millenial-puppies';
const qualifiedCard1Id = `local-hub::${card1Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: qualifiedCard1Id }];
  },
});

module('Acceptance | card schema', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test(`adding a new field to a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);

    await addField('title', 'string', true);

    await saveCard('schema', card1Id);
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await animationsSettled();
    await click('[data-test-field="title"]');
    await animationsSettled();
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('title (Text)');
    assert
      .dom('[data-test-field="title"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/images/field-types/text-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, undefined);
  });

  test(`cannot change a card's id`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);

    await showCardId(true);
    assert.dom('#card__id').isDisabled();
  });

  test(`can expand a right edge section`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);

    assert.dom('.right-edge--item #card__id').doesNotExist();

    await click('[data-test-right-edge-section-toggle="details"]');

    assert.dom('.right-edge--item #card__id').hasValue('millenial-puppies');
  });

  test(`renaming a card's field`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', false, 'test title']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);

    assert.dom('[data-test-field="title"] [data-test-field-renderer-label]').hasText('Title');
    await click('[data-test-field="title"]');
    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="name"] input', 'keyup');
    await fillIn(
      '[data-test-right-edge] [data-test-schema-attr="instructions"] textarea',
      'fill this in with your subheader'
    );
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea')
      .hasValue('fill this in with your subheader');

    await saveCard('schema', card1Id);
    assert.dom('[data-test-field="title"]').doesNotExist();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.subtitle, 'test title');
    assert.equal(card.data.attributes['metadata-summary'].subtitle.instructions, 'fill this in with your subheader');
    assert.equal(card.data.attributes.title, undefined);

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-label]').hasText('Subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields`);
    assert.dom('[data-test-field="subtitle"] input').hasValue('test title');
    assert.dom('[data-test-field="subtitle"] [data-test-cs-component-label="text-field"]').hasText('Subtitle');
    assert
      .dom('[data-test-field="subtitle"] [data-test-cs-component-validation]')
      .hasText('fill this in with your subheader');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('Subtitle');
    await click('[data-test-field="subtitle"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');
  });

  test(`changing the label for a field`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', false, 'test title']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);

    assert.dom('[data-test-field="title"] [data-test-field-renderer-label]').hasText('Title');
    await click('[data-test-field="title"]');
    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'TITLE');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="label"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await saveCard('schema', card1Id);

    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-value]').hasText('test title');
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-label]').hasText('TITLE');

    await visit(`/cards/${card1Id}/edit/fields`);
    assert.dom('[data-test-field="title"] input').hasValue('test title');
    assert.dom('[data-test-field="title"] [data-test-cs-component-label="text-field"]').hasText('TITLE');

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.dom('[data-test-field="title"] [data-test-field-renderer-label]').hasText('TITLE');
    await click('[data-test-field="title"]');
    await animationsSettled();

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');
  });

  test(`removing a field from a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['body', 'string', false, 'test body']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);

    await removeField('body');

    await saveCard('schema');
    await waitFor(`[data-test-card-schema="${card1Id}"]`);

    assert.dom('[data-test-field="body"]').doesNotExist();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.body, undefined);

    assert.dom('[data-test-right-edge] [data-test-field]').doesNotExist();
  });

  test(`move a field's position via drag & drop`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', false, 'test title'],
        ['author', 'string', false, 'test author'],
        ['body', 'string', false, 'test body'],
      ],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title', 'author', 'body']
    );

    await dragFieldToNewPosition(0, 1);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['author', 'title', 'body']
    );

    await dragFieldToNewPosition(1, 2);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['author', 'body', 'title']
    );

    await dragFieldToNewPosition(1, 0);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-card-schema="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['body', 'author', 'title']
    );

    await saveCard('schema', card1Id);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['body', 'author', 'title']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
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
      ],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="name"] input`, 'keyup');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'Subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="label"] input`, 'keyup');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await click('[data-test-field="body"]');
    await animationsSettled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('body');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Body');

    await click('[data-test-field="subtitle"]');
    await animationsSettled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await dragAndDropNewField('string');
    await animationsSettled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('field-3');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('field-3');
  });

  test(`change a field's needed-when-embedded value to true`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', false, 'test title']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await click('[data-test-right-edge] [data-test-schema-attr="embedded"] input');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], true);

    await saveCard('schema', card1Id);
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();
    cardJson = find('[data-test-card-json]').innerHTML;
    card = JSON.parse(cardJson);
    field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], true);
  });

  test(`change a field's needed-when-embedded value to false`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [['title', 'string', true, 'test title']],
    });
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-right-edge] [data-test-schema-attr="embedded"] input');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);

    await saveCard('schema', card1Id);
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await click('[data-test-field="title"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();
    cardJson = find('[data-test-card-json]').innerHTML;
    card = JSON.parse(cardJson);
    field = card.included.find(i => `${i.type}/${i.id}` === 'fields/title');
    assert.equal(field.attributes['needed-when-embedded'], false);
  });

  test(`can navigate to base card schema`, async function(assert) {
    await login();
    await visit(`/cards/@cardstack%2Fbase-card/edit/fields/schema`);

    assert.equal(currentURL(), `/cards/@cardstack%2Fbase-card/edit/fields/schema`);

    assert.dom(`[data-test-right-edge] [data-test-no-adoption]`).hasText('No Adoption');
  });
});
