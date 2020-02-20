import { module, test } from 'qunit';
import { click, find, visit, currentURL } from '@ember/test-helpers';
import { login } from '../helpers/login';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  showCardId,
  addField,
  setCardName,
  saveCard,
  setFieldValue,
  removeField,
  waitForSchemaViewToLoad,
  selectField,
  waitForCardLoad,
} from '../helpers/card-ui-helpers';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

const childName = 'vangogh-work-address';
const grandChildName = 'mango-work-address';
const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const parentCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'address-card',
    csTitle: 'Address Card',
    csFieldOrder: ['address', 'city', 'state', 'zip'],
  })
  .withField('address', 'string-field')
  .withField('city', 'string-field')
  .withField('state', 'string-field')
  .withField('zip', 'string-field');
const parentCardPath = encodeURIComponent(parentCard.canonicalURL);
const parentScenario = new Fixtures({
  create: [parentCard],
});
const scenario = new Fixtures({
  destroy: {
    cardTypes: [parentCard],
  },
});

async function setupAdoptedCard() {
  await visit(`/cards/${parentCardPath}/adopt`);
  await setCardName(childName);
  await click('[data-test-configure-schema-btn]');
  await waitForSchemaViewToLoad();
}

module('Acceptance | card adoption', function(hooks) {
  setupApplicationTest(hooks);
  parentScenario.setupModule(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });

  test('adopted fields are present', async function(assert) {
    await setupAdoptedCard();

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-isolated-card] [data-test-field]')].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['address', 'city', 'state', 'zip']
    );

    assert.dom('[data-test-field="address"] .schema-field-renderer--header--detail').hasText('Adopted');
    assert.dom('[data-test-field="city"] .schema-field-renderer--header--detail').hasText('Adopted');
    assert.dom('[data-test-field="state"] .schema-field-renderer--header--detail').hasText('Adopted');
    assert.dom('[data-test-field="zip"] .schema-field-renderer--header--detail').hasText('Adopted');

    await selectField('address');
    assert.dom('.right-edge--section-header--adopted').hasText('Adopted from Address Card');
  });

  test('can create adopted card', async function(assert) {
    await visit(`/cards/${parentCardPath}/adopt`);
    await setCardName(childName);
    await waitForCardLoad();

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'city', 'state', 'zip']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.csAdoptsFrom.data, { type: 'cards', id: parentCard.canonicalURL });
  });

  test('it displays the adopted card in the right edge', async function(assert) {
    await setupAdoptedCard();
    await showCardId(true);

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Address Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');
  });

  test('can add a field at a particular position', async function(assert) {
    await setupAdoptedCard();
    await addField('treats-available', 'boolean-field', false, 1);
    assert.dom('[data-test-field="treats-available"] .schema-field-renderer--header--detail').doesNotExist();

    await selectField('treats-available');
    assert.dom('.right-edge--section-header--adopted').doesNotExist();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['address', 'treats-available', 'city', 'state', 'zip']
    );

    await saveCard();
    await showCardId();
    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'treats-available', 'city', 'state', 'zip']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.csAdoptsFrom.data, { type: 'cards', id: parentCard.canonicalURL });
    assert.ok(card.data.attributes.csFields['treats-available']);
  });

  test('can remove own field', async function(assert) {
    await setupAdoptedCard();
    let cardId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields/schema', '');
    await addField('treats-available', 'boolean-field', false);
    await saveCard();

    assert.dom('[data-test-field="treats-available"]').exists();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.csAdoptsFrom.data, { type: 'cards', id: parentCard.canonicalURL });
    assert.ok(card.data.attributes.csFields['treats-available']);

    await visit(`/cards/${cardId}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    await removeField('treats-available');
    await saveCard();
    await showCardId();

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'city', 'state', 'zip']
    );
    cardJson = find('[data-test-card-json]').innerHTML;
    card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.csAdoptsFrom.data, { type: 'cards', id: parentCard.canonicalURL });
    assert.deepEqual(card.data.attributes.csFields, {});
  });

  test("can't remove an adopted field", async function(assert) {
    await setupAdoptedCard();

    assert.dom('[data-test-field-renderer-remove-btn]').doesNotExist();
  });

  test("can't edit adopted field's name, label, or embedded properties", async function(assert) {
    await setupAdoptedCard();

    await selectField('address');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('address');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').isDisabled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').isDisabled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isDisabled();
  });

  test('can edit the data of an adopted card', async function(assert) {
    await setupAdoptedCard();
    let cardId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields/schema', '');
    await addField('treats-available', 'boolean-field', false);
    await saveCard();

    await visit(`/cards/${cardId}/edit/fields`);
    await waitForCardLoad();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['treats-available', 'address', 'city', 'state', 'zip']
    );

    await setFieldValue('treats-available', true);
    await setFieldValue('address', '105 Barkley Lane');
    await setFieldValue('city', 'Puppyville');
    await setFieldValue('state', 'MA');
    await setFieldValue('zip', '01234');

    await saveCard();
    assert.equal(currentURL(), `/cards/${cardId}/edit/fields`);

    await click('[data-test-mode-indicator-link="view"]');
    await waitForCardLoad();

    assert.dom('[data-test-field="treats-available"] [data-test-boolean-field-viewer-value]').hasText('Yes');
    assert.dom('[data-test-field="address"] [data-test-string-field-viewer-value]').hasText('105 Barkley Lane');
    assert.dom('[data-test-field="city"] [data-test-string-field-viewer-value]').hasText('Puppyville');
    assert.dom('[data-test-field="state"] [data-test-string-field-viewer-value]').hasText('MA');
    assert.dom('[data-test-field="zip"] [data-test-string-field-viewer-value]').hasText('01234');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes['treats-available'], true);
    assert.equal(card.data.attributes.address, '105 Barkley Lane');
    assert.equal(card.data.attributes.city, 'Puppyville');
    assert.equal(card.data.attributes.state, 'MA');
    assert.equal(card.data.attributes.zip, '01234');
  });

  test('can create a card that has an adoption chain of multiple cards', async function(assert) {
    await setupAdoptedCard();
    let cardId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields/schema', '');
    await addField('treats-available', 'boolean-field', true);
    await saveCard();
    await showCardId();

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Address Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');

    await visit(`/cards/${cardId}/adopt`);
    await setCardName(grandChildName);
    await click('[data-test-configure-schema-btn]');
    await waitForSchemaViewToLoad();

    await addField('number-of-bones', 'integer-field', true, 5);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );

    await saveCard();
    await showCardId();

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText(childName);
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Address Card');
    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.csAdoptsFrom.data, { type: 'cards', id: decodeURIComponent(cardId) });
    assert.ok(card.data.attributes.csFields['number-of-bones']);
  });

  test('adopted card can receive upstream changes', async function(assert) {
    await setupAdoptedCard();
    let cardId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields/schema', '');
    await addField('treats-available', 'boolean-field', true);
    await saveCard();

    await visit(`/cards/${cardId}/adopt`);
    await setCardName(grandChildName);
    let grandChildId = currentURL()
      .replace('/cards/', '')
      .replace('/edit/fields', '');

    await visit(`/cards/${cardId}/edit/fields/schema`);
    await waitForSchemaViewToLoad();
    await addField('number-of-bones', 'integer-field', true);
    await saveCard();

    await visit(`/cards/${grandChildId}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );
    assert.dom('[data-test-field="number-of-bones"] .schema-field-renderer--header--detail').hasText('Adopted');
  });
});
