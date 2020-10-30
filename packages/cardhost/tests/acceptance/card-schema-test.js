import { module, test } from 'qunit';
import { click, find, visit, currentURL, fillIn, triggerEvent, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  saveCard,
  removeField,
  dragAndDropNewField,
  dragFieldToNewPosition,
  waitForSchemaViewToLoad,
  waitForCardPatch,
  waitForCardLoad,
  selectField,
  encodeColons,
  waitForCardAutosave,
  waitForTestsToEnd,
  waitForAnimation,
  CARDS_URL,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { animationsSettled } from 'ember-animated/test-support';
import { cardDocument } from '@cardstack/hub';
import { canonicalURL } from '@cardstack/hub';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

const timeout = 5000;
const csRealm = `http://localhost:3000/api/realms/default`;
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldOrder: ['title', 'author', 'body'],
    csFieldSets: {
      embedded: ['author'],
      isolated: ['title', 'author', 'body'],
    },
    title: 'test title',
    author: 'test author',
    body: 'test body',
  })
  .withField('title', 'string-field', 'singular')
  .withField('author', 'string-field', 'singular')
  .withField('body', 'string-field', 'singular');
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard],
});

module('Acceptance | card schema', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`adding a new field to a card`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();
    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}/configure/fields`);

    await addField('title-new', 'string-field', true);
    await saveCard();

    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();
    await selectField('title-new');

    assert.dom('[data-test-field="title-new"] [data-test-field-renderer-type]').hasText('title-new (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let isolatedFields = card.data.attributes.csFieldSets.isolated;
    assert.equal(card.data.attributes['title-new'], undefined);
    assert.ok(card.data.attributes.csFields['title-new']);
    assert.ok(isolatedFields.includes('title-new'), 'isolated fields sets are correct');
  });

  test(`Can change a card's name`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();
    await showCardId(true);

    await fillIn('#card_name', 'New Card Name');
    await triggerEvent('#card_name', 'keyup');
    await waitForCardPatch();
    assert.dom('#card_name').hasValue('New Card Name');
    assert.dom('.card-renderer-isolated--header-title').hasText('New Card Name');

    await saveCard();
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();
    await showCardId();
    assert.dom('#card_name').hasValue('New Card Name');
    assert.dom('.card-renderer-isolated--header-title').hasText('New Card Name');
  });

  test(`can expand a right edge section`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await showCardId();
    assert.dom('.right-edge--item [data-test-internal-card-id]').doesNotExist();
    await click('[data-test-right-edge-section-toggle="details"]');
    await animationsSettled();
    assert.dom('.right-edge--item [data-test-internal-card-id]').hasText(decodeURIComponent(cardPath));
  });

  test(`changing the label for a field`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('[data-test-isolated-card] [data-test-field="title"] [data-test-field-renderer-label]').hasText('title');

    await fillIn('[data-test-right-edge] [data-test-schema-attr="label"] input', 'TITLE');
    await triggerEvent('[data-test-right-edge] [data-test-schema-attr="label"] input', 'keyup');
    await waitForCardPatch();

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await saveCard();
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert
      .dom('[data-test-isolated-card] [data-test-field="title"] [data-test-field-renderer-value]')
      .hasText('test title');
    assert.dom('[data-test-isolated-card] [data-test-field="title"] [data-test-field-renderer-label]').hasText('TITLE');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('TITLE');

    await visit(`${CARDS_URL}/${cardPath}/edit`);
    await waitForCardLoad();
    assert.dom('[data-test-isolated-card] [data-test-field="title"] input').hasValue('test title');
    assert.dom('[data-test-isolated-card] [data-test-field="title"] [data-test-edit-field-label]').hasText('TITLE');
  });

  test(`adding a new field after removing one`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await removeField('body');

    assert.dom('[data-test-field="body"]').doesNotExist();
    await dragAndDropNewField('string-field');
    assert.dom('[data-test-field="field-1"]').exists();
  });

  test(`move a field's position via drag & drop`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title', 'author', 'body']
    );

    await dragFieldToNewPosition(0, 1);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['author', 'title', 'body']
    );

    await dragFieldToNewPosition(1, 2);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['author', 'body', 'title']
    );

    await dragFieldToNewPosition(1, 0);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['body', 'author', 'title']
    );

    await saveCard();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['body', 'author', 'title']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.csFieldOrder, ['body', 'author', 'title']);
  });

  test(`change a field's needed-when-embedded value to true`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
    await waitForCardPatch();
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    await saveCard();
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await selectField('title');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let embeddedFields = card.data.attributes.csFieldSets.embedded;
    assert.ok(embeddedFields.includes('title'), 'embedded fields sets are correct');
  });

  test(`change a field's needed-when-embedded value to false`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await selectField('author');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isChecked();

    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
    await waitForCardPatch();
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    await saveCard();
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await selectField('author');
    assert.dom('[data-test-schema-attr="embedded"] input[type="checkbox"]').isNotChecked();

    let cardJson = find('[data-test-card-json]').innerHTML;
    cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    let embeddedFields = card.data.attributes.csFieldSets.embedded;
    assert.notOk(embeddedFields.includes('author'), 'embedded fields sets are correct');
  });

  test(`can navigate to base card schema`, async function(assert) {
    let baseCardPath = encodeURIComponent(canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }));
    await visit(`${CARDS_URL}/${baseCardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    await focus(`.card-renderer-isolated`);
    await waitFor(`[data-test-no-adoption]`, { timeout });
    assert.dom(`[data-test-right-edge] [data-test-no-adoption]`).hasText('No Adoption');
  });

  test(`can navigate from schema to edit via "return to editing" button`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.dom('[data-test-return-to-editing]').hasText('Return to Editing');
    await click('[data-test-return-to-editing]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}/edit`);
  });

  test(`fields mode displays the top edge`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-mode-indicator-link="configure"]').exists();
    assert.dom('[data-test-mode-indicator]').containsText('configure mode');
    assert.dom('[data-test-edge-actions-btn]').exists();

    await animationsSettled();
    await waitForAnimation(async () => await percySnapshot(assert));
  });

  test(`layout mode displays the top edge with additional controls`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-top-edge-preview-link]').exists();
    assert.dom('[data-test-top-edge-size-buttons]').exists();
    assert.dom('[data-test-top-edge-preview-link]').doesNotHaveClass('hidden');
    assert.dom('[data-test-top-edge-size-buttons]').doesNotHaveClass('hidden');
    assert.dom('[data-test-view-selector]').exists();
    assert.dom('[data-test-view-selector="layout"]').hasClass('active');
    assert.dom('[data-test-mode-indicator-link="configure"]').exists();
    assert.dom('[data-test-edge-actions-btn]').exists();
    await animationsSettled();
    await waitForAnimation(async () => await percySnapshot(assert));
  });

  test(`can navigate to edit mode using the top edge`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    assert.dom('[data-test-mode-indicator-link="configure"]').exists();
    await click('[data-test-mode-indicator-link="configure"]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
    assert.dom('[data-test-mode-indicator-link="view"]').exists();

    await visit(`${CARDS_URL}/${cardPath}/configure/layout`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}/configure/layout`);

    await click('[data-test-mode-indicator]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `${CARDS_URL}/${cardPath}`);
  });

  test('autosave works', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}/configure/fields`);
    await waitForSchemaViewToLoad();

    this.owner.lookup('service:autosave').autosaveDisabled = false;
    await addField('new-title', 'string-field', true);
    await waitForCardAutosave();
    this.owner.lookup('service:autosave').autosaveDisabled = true;

    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();

    assert.dom('[data-test-field="new-title"]').exists();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.ok(card.data.attributes.csFields['new-title']);
  });
});
