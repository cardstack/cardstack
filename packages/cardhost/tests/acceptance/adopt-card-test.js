import { module, test, skip } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import {
  showCardId,
  addField,
  setCardId,
  createCards,
  saveCard,
  setFieldValue,
  removeField,
} from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';

const timeout = 20000;
const card1Id = 'address-card';
const card2Id = 'vangogh-work-address';
const card3Id = 'mango-work-address';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const qualifiedCard2Id = `local-hub::${card2Id}`;
const qualifiedCard3Id = `local-hub::${card3Id}`;

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: qualifiedCard3Id },
      { type: 'cards', id: qualifiedCard2Id },
      { type: 'cards', id: qualifiedCard1Id },
    ];
  },
});

async function setupParentCard() {
  await login();
  await createCards({
    [card1Id]: [
      ['address', 'string', true],
      ['city', 'string', true],
      ['state', 'string', true],
      ['zip', 'string', true],
    ],
  });
}

module('Acceptance | card adoption', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('new cards get a default id', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    assert.equal(currentURL(), `/cards/${card1Id}/adopt`);

    await saveCard('creator');

    assert.ok(currentURL().match(/\/cards\/new-card-[0-9]+/));
    await percySnapshot(assert);
  });

  test('adopted fields are present', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

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

    await click('[data-test-field="address"]');
    assert.dom('.right-edge--section-header--adopted').hasText('Adopted from address-card');
  });

  test('can create adopted card', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await saveCard('creator', card2Id);

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'city', 'state', 'zip']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships['adopted-from'].data, { type: 'cards', id: qualifiedCard1Id });
    assert.deepEqual(card.data.relationships.fields.data, []);
  });

  test('it displays the adopted card in the right edge', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await saveCard('creator', card2Id);

    await visit(`/cards/${card2Id}/edit/fields/schema`);

    await showCardId(true);

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText(card1Id);
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');
  });

  test('can add a field at a particular position', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await addField('treats-available', 'boolean', false, 1);
    assert.dom('[data-test-field="treats-avialable"] .schema-field-renderer--header--detail').doesNotExist();

    await click('[data-test-field="treats-available"]');
    assert.dom('.right-edge--section-header--adopted').doesNotExist();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['address', 'treats-available', 'city', 'state', 'zip']
    );

    await saveCard('creator', card2Id);

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'treats-available', 'city', 'state', 'zip']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships['adopted-from'].data, { type: 'cards', id: qualifiedCard1Id });
    assert.deepEqual(card.data.relationships.fields.data, [{ type: 'fields', id: 'treats-available' }]);
  });

  test('can remove own field', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await addField('treats-available', 'boolean', false);

    await saveCard('creator', card2Id);

    assert.dom('[data-test-field="treats-available"]').exists();
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships['adopted-from'].data, { type: 'cards', id: qualifiedCard1Id });
    assert.deepEqual(card.data.relationships.fields.data, [{ type: 'fields', id: 'treats-available' }]);

    await visit(`/cards/${card2Id}/edit/fields/schema`);
    await removeField('treats-available');
    await saveCard('schema', card2Id);

    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['address', 'city', 'state', 'zip']
    );
    cardJson = find('[data-test-card-json]').innerHTML;
    card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships['adopted-from'].data, { type: 'cards', id: qualifiedCard1Id });
    assert.deepEqual(card.data.relationships.fields.data, []);
  });

  test("can't remove an adopted field", async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    assert.dom('[data-test-field-renderer-remove-btn]').doesNotExist();
    await setCardId(card2Id);
    await saveCard('creator', card2Id);

    assert.dom('[data-test-field-renderer-remove-btn]').doesNotExist();
  });

  test("can't edit adopted field's name, label, or embedded properties", async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await click('[data-test-field="address"]');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('address');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').isDisabled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Address');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').isDisabled();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isDisabled();
  });

  // Need to complete issue #980 first
  skip("TODO can edit adopted fields's helper text", async function(/*assert*/) {});

  test('can edit the data of an adopted card', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await addField('treats-available', 'boolean', false);

    await saveCard('creator', card2Id);

    await visit(`/cards/${card2Id}/edit/fields`);

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

    await saveCard('editor', card2Id);
    assert.equal(currentURL(), `/cards/${card2Id}/edit/fields`);

    await click('[data-test-top-edge-link="view"]');
    await waitFor(`[data-test-card-view="${card2Id}"]`, { timeout });
    assert.dom('[data-test-field="treats-available"] [data-test-boolean-field-viewer-value]').hasText('true');
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
    await setupParentCard();

    await visit(`/cards/${card1Id}/adopt`);
    await setCardId(card2Id);
    await addField('treats-available', 'boolean', true);
    await saveCard('creator', card2Id);

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText(card1Id);
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');

    await visit(`/cards/${card2Id}/adopt`);
    await setCardId(card3Id);
    await addField('number-of-bones', 'integer', true, 5);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );

    await saveCard('creator', card3Id);

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText(card2Id);
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText(card1Id);
    assert.deepEqual(
      [...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );
    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships['adopted-from'].data, { type: 'cards', id: qualifiedCard2Id });
    assert.deepEqual(card.data.relationships.fields.data, [{ type: 'fields', id: 'number-of-bones' }]);
  });

  test('adopted card can receive upstream changes', async function(assert) {
    await setupParentCard();

    await visit(`/cards/${card1Id}/adopt`);
    await setCardId(card2Id);
    await addField('treats-available', 'boolean', true);
    await saveCard('creator', card2Id);

    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await addField('number-of-bones', 'integer', true);
    await saveCard('schema', card1Id);

    await visit(`/cards/${card2Id}/edit/fields/schema`);
    await animationsSettled();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['treats-available', 'address', 'city', 'state', 'zip', 'number-of-bones']
    );
    assert.dom('[data-test-field="number-of-bones"] .schema-field-renderer--header--detail').hasText('Adopted');
  });

  test('removing adoptedFrom card makes it adopted from base card', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/adopt`);

    await setCardId(card2Id);
    await saveCard('creator', card2Id);

    await visit(`/cards/${card2Id}/edit/fields/schema`);

    await showCardId();

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText(card1Id);
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').hasText('Base Card');

    await click(`[data-test-right-edge] [data-test-remove-adopted-from-btn]`);
    await waitFor('[data-test-right-edge] [data-test-remove-adopted-from-btn]:not(.is-running)', { timeout });

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').doesNotExist();
  });

  test('remove button is disabled if adopted from base card', async function(assert) {
    await setupParentCard();
    await visit(`/cards/${card1Id}/edit/fields/schema`);

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').doesNotExist();
    assert.dom('[data-test-right-edge] [data-test-remove-adopted-from-btn]').isDisabled();
  });

  // Waiting on UI designs
  skip('TODO cannot add a field that has the same name as an adopted field', async function(/*assert*/) {});
});
