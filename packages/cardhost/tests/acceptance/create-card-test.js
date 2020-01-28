import { module, test } from 'qunit';
import { click, fillIn, find, visit, currentURL, triggerEvent, focus } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import {
  showCardId,
  addField,
  setCardId,
  createCards,
  saveCard,
  dragAndDropNewField,
  removeField,
} from '@cardstack/test-support/card-ui-helpers';
import { setupMockUser, login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
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

module('Acceptance | card create', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.lookup('service:data')._clearCache();
    this.owner.lookup('service:card-local-storage').clearIds();
  });

  test('new cards get a default id', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await saveCard('creator');

    assert.ok(currentURL().match(/\/cards\/new-card-[0-9]+\/edit\/fields\/schema/));
  });

  test('card element is selected on initial render', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
  });

  test('right edge shows base card as adopted from card', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
    assert.dom('[data-test-right-edge] [data-test-adopted-card-adopted-card-name]').doesNotExist();
  });

  test("changing a card's id does not clear the card fields", async function(assert) {
    await login();
    await visit('/cards/new');

    await addField('title', 'string', true);
    await setCardId(card1Id);
    await animationsSettled();
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title']
    );
  });

  test('creating a card', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');
    await percySnapshot([assert.test.module.name, assert.test.testName, 'new'].join(' | '));

    assert.dom('.card-renderer-isolated--header').hasTextContaining('new-card-');
    assert.dom('[data-test-internal-card-id]').hasTextContaining('local-hub::new-card-');

    await createCards({
      [card1Id]: [
        ['title', 'string', true],
        ['body', 'string', false],
        ['author', 'related card', true],
        ['reviewers', 'related cards', true],
      ],
    });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    await visit(`/cards/${card1Id}/edit/fields/schema`);
    await showCardId(true);
    assert.dom('.card-renderer-isolated--header').hasText('millenial-puppies');
    assert.dom('[data-test-internal-card-id]').hasText('local-hub::millenial-puppies');

    await click('[data-test-field="title"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="title"]').hasClass('selected');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-type]').hasText('title (Text)');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-field="body"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="body"]').hasClass('selected');
    assert.dom('[data-test-field="body"] [data-test-field-renderer-type]').hasText('body (Text)');
    assert
      .dom('[data-test-field="body"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/images/field-types/text-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isNotChecked();

    await click('[data-test-field="author"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="author"]').hasClass('selected');
    assert.dom('[data-test-field="author"] [data-test-field-renderer-type]').hasText('author (Single-select)');
    assert
      .dom('[data-test-field="author"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/images/field-types/dropdown-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await click('[data-test-field="reviewers"] [data-test-field-schema-renderer]');
    assert.dom('[data-test-isolated-card="millenial-puppies"] [data-test-field="reviewers"]').hasClass('selected');
    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-type]').hasText('reviewers (Multi-select)');
    assert
      .dom('[data-test-field="reviewers"] [data-test-field-renderer-type]')
      .hasAttribute('style', 'background-image: url("/images/field-types/has-many-field-icon.svg")');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="embedded"] input').isChecked();

    await focus('[data-test-card-renderer-isolated]');
    await animationsSettled();
    assert.dom('.card-renderer-isolated--header').hasText('millenial-puppies');
    assert.dom('[data-test-internal-card-id]').hasText('local-hub::millenial-puppies');
    // TODO: figure out why having the following assertions before the line above ^^^ causes a test failure
    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
    assert.dom('[data-test-field]').doesNotHaveClass('selected');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.deepEqual(card.data.relationships.reviewers, undefined);
    await percySnapshot([assert.test.module.name, assert.test.testName, 'data-entered'].join(' | '));
  });

  test(`selecting a field`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
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
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('title');
    await fillIn('[data-test-schema-attr="name"] input', 'subtitle');
    await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');

    assert.dom('[data-test-right-edge] [data-test-schema-attr="name"] input').hasValue('subtitle');
    assert.dom('[data-test-right-edge] [data-test-schema-attr="label"] input').hasValue('Subtitle');

    await saveCard('creator', card1Id);

    assert.equal(currentURL(), `/cards/${card1Id}/edit/fields/schema`);

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
    await visit('/cards/new');

    await setCardId(card1Id);
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
    await visit('/cards/new');
    await setCardId(card1Id);
    await addField('title', 'string', true);
    await removeField('title');
    assert.dom('.cardhost-right-edge-panel [data-test-field]').doesNotExist();
    await animationsSettled();
    await percySnapshot(assert);
  });

  test(`removing a field from a card that has an empty name`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('', 'string', true);
    assert.dom('[data-test-isolated-card] [data-test-field').exists({ count: 1 });

    await click(`[data-test-isolated-card] [data-test-field-renderer-remove-btn]`);
    await animationsSettled();
    assert.dom('[data-test-isolated-card] [data-test-field').doesNotExist();
  });

  test('can add a field at a particular position', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false, 1);
    await addField('author', 'string', false, 1);

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-isolated-card="${card1Id}"] [data-test-field]`)].map(i =>
        i.getAttribute('data-test-field')
      ),
      ['title', 'author', 'body']
    );

    await saveCard('creator', card1Id);

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
