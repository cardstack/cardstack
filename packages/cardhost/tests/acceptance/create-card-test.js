import { module, test, skip } from 'qunit';
import { click, fillIn, find, visit, currentURL, triggerEvent, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  setCardName,
  saveCard,
  dragAndDropNewField,
  selectField,
  removeField,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const card1Name = 'Millenial Puppies';
const timeout = 5000;

const scenario = new Fixtures({
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | card create', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('right edge shows base card as adopted from card', async function(assert) {
    await login();
    await visit('/cards/add');
    await setCardName(card1Name);

    assert.ok(/^\/cards\/.*\/edit\/fields$/.test(currentURL()), 'URL is correct');

    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').doesNotExist();
  });

  test('creating a card', async function(assert) {
    await login();

    await visit('/cards/add');
    assert.equal(currentURL(), '/cards/add');

    await percySnapshot([assert.test.module.name, assert.test.testName, 'new'].join(' | '));
    await setCardName(card1Name);
    let cardId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields', '');

    assert.ok(/^\/cards\/.*\/edit\/fields$/.test(currentURL()), 'URL is correct');
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });

    assert.dom('.card-renderer-isolated--header').hasText('Millenial Puppies');

    await addField('title', 'string-field', true);
    await addField('body', 'string-field', false);
    await addField('author', 'base', true);
    await addField('reviewers', 'base', true);

    await showCardId(true);
    assert.dom('.card-renderer-isolated--header').hasText('Millenial Puppies');
    assert.dom('[data-test-internal-card-id]').hasText(decodeURIComponent(cardId));

    await selectField('title');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="title"]').hasClass('selected');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('title (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await selectField('body');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="body"]').hasClass('selected');
    assert.dom('[data-test-field="body"] [data-test-field-renderer-type]').hasText('body (Text)');
    assert
      .dom('[data-test-field="body"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/assets/images/field-types/text-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await selectField('author');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="author"]').hasClass('selected');
    assert.dom('[data-test-field="author"] [data-test-field-renderer-type]').hasText('author (Single-select)');
    assert
      .dom('[data-test-field="author"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/assets/images/field-types/dropdown-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await selectField('reviewers');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="reviewers"]').hasClass('selected');
    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-type]').hasText('reviewers (Multi-select)');
    assert
      .dom('[data-test-field="reviewers"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/assets/images/field-types/has-many-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await showCardId(true);
    await animationsSettled();
    assert.dom('.card-renderer-isolated--header').hasText('Millenial Puppies');
    assert.dom('[data-test-internal-card-id]').hasTextContaining(decodeURIComponent(cardId));
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.deepEqual(card.data.relationships.reviewers, undefined);
    await percySnapshot([assert.test.module.name, assert.test.testName, 'data-entered'].join(' | '));
  });

  test('creating a card from the homepage', async function(assert) {
    await login();
    await visit('/');

    assert.equal(currentURL(), '/');
    await percySnapshot(assert);
    await click('[data-test-new-blank-card-btn]');
    await setCardName(card1Name);

    assert.ok(/^\/cards\/.*\/edit\/fields$/.test(currentURL()), 'URL is correct');
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });

    assert.dom('.card-renderer-isolated--header').hasText('millenial-puppies');

    await addField('title', 'string', true);
    await addField('body', 'string', false);
    await addField('author', 'related card', true);
    await addField('reviewers', 'related cards', true);

    await showCardId(true);
    assert.dom('.card-renderer-isolated--header').hasText('millenial-puppies');
    assert.dom('[data-test-internal-card-id]').hasText('local-hub::millenial-puppies');
  });

  test(`selecting a field`, async function(assert) {
    await login();
    await visit('/cards/add');

    await setCardName(card1Name);
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('title', 'string', true);
    await addField('body', 'string', false);

    await click('[data-test-field="title"]');
    await animationsSettled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="name"] input`, 'keyup');
    await animationsSettled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="label"] input`, 'keyup');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea', 'This is the subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="instructions"] textarea`, 'keyup');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea')
      .hasValue('This is the subtitle');

    await click('[data-test-field="body"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="body"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('body');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Body');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea').hasValue('');

    await click('[data-test-field="subtitle"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="subtitle"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea')
      .hasValue('This is the subtitle');

    await dragAndDropNewField('string');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="field-1"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('field-1');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('field-1');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea').hasValue('');
    await percySnapshot(assert);
  });

  test(`renaming a card's field`, async function(assert) {
    await login();
    await visit('/cards/add');

    await setCardName(card1Name);
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('title', 'string', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await saveCard();

    assert.ok(/^\/cards\/.*\/edit\/fields\/schema$/.test(currentURL()), 'URL is correct');
    let card1Id = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields/schema', '');

    await visit(`/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-label]').hasText('Subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields`);
    assert.dom('[data-test-field="subtitle"] [data-test-cs-component-label="text-field"]').hasText('Subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('Subtitle');
    await click('[data-test-field="subtitle"]');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');
  });

  test(`entering invalid field name shows error`, async function(assert) {
    await login();
    await visit('/cards/add');

    await setCardName(card1Name);
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('title', 'string', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'Title!');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('Title!');
    assert.dom('[data-test-schema-attr="name"] input').hasClass('invalid');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Title');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="name"] [data-test-cs-component-validation="text-field"]')
      .hasText('Can only contain letters, numbers, dashes, and underscores.');

    await percySnapshot(assert);
  });

  test(`removing a field from a card`, async function(assert) {
    await login();
    await visit('/cards/add');
    await setCardName(card1Name);
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('title', 'string', true);
    await removeField('title');
    assert.dom('.cardhost-right-edge-panel [data-test-field]').doesNotExist();
    await animationsSettled();
    await percySnapshot(assert);
  });

  test(`removing a field from a card that has an empty name`, async function(assert) {
    await login();
    await visit('/cards/add');

    await setCardName(card1Name);
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('', 'string', true);
    assert.dom('[data-test-isolated-card] [data-test-field').exists({ count: 1 });

    await click(`[data-test-isolated-card] [data-test-field-renderer-remove-btn]`);
    await animationsSettled();
    assert.dom('[data-test-isolated-card] [data-test-field').doesNotExist();
  });

  skip('can add a field at a particular position', async function(assert) {
    await login();
    await visit('/cards/add');

    await setCardName(card1Name);
    let card1Id = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields', '');
    await click('[data-test-configure-schema-btn]');
    await waitFor('[data-test-right-edge]', { timeout });
    await addField('title', 'string', true);
    await addField('body', 'string', false, 1);
    await addField('author', 'string', false, 1);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title', 'author', 'body']
    );

    await saveCard();

    await visit(`/cards/${card1Id}`);
    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'title' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'body' },
    ]);
  });
});
