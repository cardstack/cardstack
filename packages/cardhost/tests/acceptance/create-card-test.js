import { module, test } from 'qunit';
import { click, fillIn, find, visit, currentURL, triggerEvent, blur } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  setCardName,
  saveCard,
  dragAndDropNewField,
  selectField,
  waitForFieldNameChange,
  removeField,
  waitForCardPatch,
  waitForCardLoad,
  waitForCardAutosave,
  waitForTestsToEnd,
  waitForLibraryServiceToIdle,
  getEncodedCardIdFromURL,
  waitForAnimation,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

const card1Name = 'Millenial Puppies';

const scenario = new Fixtures({
  destroy: {
    cardTypes: [{ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }],
  },
});

module('Acceptance | card create', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test('right edge shows base card as adopted from card', async function(assert) {
    await visit('/cards/add');
    await setCardName(card1Name);
    await showCardId();

    assert.ok(/^\/cards\/.*\/edit\/fields\/schema$/.test(currentURL()), 'URL is correct');

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').doesNotExist();
  });

  test('creating a card', async function(assert) {
    await visit('/cards/add');
    assert.equal(currentURL(), '/cards/add');

    await percySnapshot([assert.test.module.name, assert.test.testName, 'new'].join(' | '));
    await setCardName(card1Name);
    let cardId = getEncodedCardIdFromURL();

    assert.ok(/^\/cards\/.*\/edit\/fields\/schema$/.test(currentURL()), 'URL is correct');

    assert.dom('.card-renderer-isolated--header-title').hasText('Millenial Puppies');

    await addField('title', 'string-field', true);
    await addField('body', 'string-field', false);
    await addField('author', 'base', true);
    await addField('reviewers', 'base', true);

    await showCardId(true);
    assert.dom('.card-renderer-isolated--header-title').hasText('Millenial Puppies');
    assert.dom('[data-test-internal-card-id]').hasText(decodeURIComponent(cardId));

    await selectField('title');
    assert.dom('[data-test-isolated-card] [data-test-field="title"]').hasClass('selected');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('title (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await selectField('body');
    assert.dom('[data-test-isolated-card] [data-test-field="body"]').hasClass('selected');
    assert.dom('[data-test-field="body"] [data-test-field-renderer-type]').hasText('body (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await selectField('author');
    assert.dom('[data-test-isolated-card] [data-test-field="author"]').hasClass('selected');
    assert.dom('[data-test-field="author"] [data-test-field-renderer-type]').hasText('author (Base Card)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await selectField('reviewers');
    assert.dom('[data-test-isolated-card] [data-test-field="reviewers"]').hasClass('selected');
    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-type]').hasText('reviewers (Base Card)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await showCardId();
    assert.dom('.card-renderer-isolated--header-title').hasText('Millenial Puppies');
    assert.dom('[data-test-internal-card-id]').hasTextContaining(decodeURIComponent(cardId));
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.equal(card.data.relationships.reviewers, undefined);
    assert.ok(card.data.attributes.csFields.title);
    assert.ok(card.data.attributes.csFields.body);
    assert.ok(card.data.attributes.csFields.author);
    assert.ok(card.data.attributes.csFields.reviewers);

    await waitForAnimation();
    await animationsSettled();
    await percySnapshot([assert.test.module.name, assert.test.testName, 'data-entered'].join(' | '));
  });

  test('creating a card from the library', async function(assert) {
    await visit('/');

    assert.equal(currentURL(), '/cards');
    await click('[data-test-library-button]');
    await waitForLibraryServiceToIdle();

    let cardCount = [...document.querySelectorAll(`[data-test-library-recent-card-link]`)].length;

    await click('[data-test-library-new-blank-card-btn]');
    await setCardName(card1Name);
    let cardId = getEncodedCardIdFromURL();

    assert.ok(/^\/cards\/.*\/edit\/fields\/schema$/.test(currentURL()), 'URL is correct');
    assert.dom('.card-renderer-isolated--header-title').hasText('Millenial Puppies');

    await addField('title', 'string-field', true);
    await addField('body', 'string-field', false);
    await addField('author', 'base', true);
    await addField('reviewers', 'base', true);

    await showCardId(true);
    assert.dom('.card-renderer-isolated--header-title').hasText('Millenial Puppies');
    assert.dom('[data-test-internal-card-id]').hasText(decodeURIComponent(cardId));

    await click('[data-test-library-button]');
    await waitForLibraryServiceToIdle();
    await waitForCardLoad(decodeURIComponent(cardId));
    assert.equal(currentURL(), `/cards/${cardId}/edit/fields/schema`);

    assert.equal(
      [...document.querySelectorAll(`[data-test-library-recent-card-link]`)].length,
      cardCount + 1,
      'a card was added to the library'
    );
    assert.equal(
      [...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`)]
        .map(i => i.getAttribute('data-test-card-renderer-embedded'))
        .includes(decodeURIComponent(cardId)),
      true,
      'the newly created card appears in the library'
    );
  });

  test(`selecting a field`, async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('title', 'string-field', true);
    await addField('body', 'string-field', false);

    await selectField('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="name"] input`, 'keyup');
    await waitForFieldNameChange('subtitle');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'subtitle label');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="label"] input`, 'keyup');
    await waitForCardPatch();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle label');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea', 'This is the subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="instructions"] textarea`, 'keyup');
    await blur(`[data-test-right-edge] [data-test-schema-attr="instructions"] textarea`);
    await waitForCardPatch();
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea')
      .hasValue('This is the subtitle');

    await selectField('body');
    assert.dom('[data-test-isolated-card] [data-test-field="body"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('body');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea').hasValue('');

    await selectField('subtitle');
    assert.dom('[data-test-isolated-card] [data-test-field="subtitle"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('subtitle label');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea')
      .hasValue('This is the subtitle');

    await dragAndDropNewField('string-field');
    assert.dom('[data-test-isolated-card] [data-test-field="field-1"]').hasClass('selected');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('field-1');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="instructions"] textarea').hasValue('');
    await waitForAnimation();
    await animationsSettled();
    await waitForAnimation(async () => await percySnapshot(assert));
  });

  test(`renaming a card's field`, async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('title', 'string-field', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');
    await waitForFieldNameChange('subtitle');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'Subtitle');
    await triggerEvent(`[data-test-right-edge] [data-test-schema-attr="label"] input`, 'keyup');
    await waitForCardPatch();

    await saveCard();

    assert.ok(/^\/cards\/.*\/edit\/fields\/schema$/.test(currentURL()), 'URL is correct');
    let card1Id = getEncodedCardIdFromURL();

    await visit(`/cards/${card1Id}`);
    await animationsSettled();
    assert.dom('[data-test-field="subtitle"] [data-test-string-field-viewer-label]').hasText('Subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields`);
    await animationsSettled();
    assert.dom('[data-test-field="subtitle"] [data-test-cs-component-label="text-field"]').hasText('Subtitle');
    assert.dom('[data-test-field="title"]').doesNotExist();

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await animationsSettled();
    assert.dom('[data-test-field="subtitle"] [data-test-field-renderer-label]').hasText('Subtitle');

    await selectField('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.ok(card.data.attributes.csFields.subtitle);
  });

  test(`entering invalid field name shows error`, async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('title', 'string-field', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'Title!');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('Title!');
    assert.dom('[data-test-schema-attr="name"] input').hasClass('invalid');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('');
    assert
      .dom('[data-test-right-edge] [data-test-schema-attr="name"] [data-test-cs-component-validation="text-field"]')
      .hasText('Can only contain letters, numbers, dashes, and underscores.');

    await waitForAnimation(async () => await percySnapshot(assert));
  });

  test(`removing a field from a card`, async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('title', 'string-field', true);

    await removeField('title');

    assert.dom('.cardhost-right-edge-panel [data-test-field]').doesNotExist();
    await percySnapshot(assert);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.csFields, {});
  });

  test(`removing a field from a card that has an empty name`, async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('', 'string-field', true);
    assert.dom('[data-test-isolated-card] [data-test-field]').exists({ count: 1 });

    await click(`[data-test-field] [data-test-field-renderer-remove-btn]`);
    await waitForCardPatch();
    await animationsSettled();

    assert.dom('[data-test-isolated-card] [data-test-field]').doesNotExist();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.csFields, {});
  });

  test('can add a field at a particular position', async function(assert) {
    await visit('/cards/add');

    await setCardName(card1Name);
    await addField('title', 'string-field', true);
    await addField('body', 'string-field', false, 1);
    await addField('author', 'string-field', false, 1);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title', 'author', 'body']
    );

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.csFieldOrder, ['title', 'author', 'body']);
  });

  test('autosave works', async function(assert) {
    await visit('/cards/add');
    await setCardName(card1Name);
    let card1Id = getEncodedCardIdFromURL();
    this.owner.lookup('service:autosave').autosaveDisabled = false;
    await addField('title', 'string-field', true);
    await waitForCardAutosave();
    this.owner.lookup('service:autosave').autosaveDisabled = true;

    await visit(`/cards/${card1Id}`);
    await waitForCardLoad();

    assert.dom('[data-test-field="title"]').exists();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.ok(card.data.attributes.csFields['title']);
  });
});
