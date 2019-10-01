import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, setCardId, setFieldValue, removeField } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const card1Id = 'local-hub::article-card::millenial-puppies';

async function createCard() {
  await visit('/cards/new');
  await setCardId(card1Id);
  await addField('body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.');
  await click('[data-test-card-creator-save-btn]');
  await waitFor(`[data-test-card-updator="${card1Id}"]`);
}

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: card1Id }];
  }
});

module('Acceptance | updating a card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test(`updating a card's field value`, async function(assert) {
    await login();
    await createCard();
    await visit(`/cards/${card1Id}`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    await setFieldValue('body', 'updated body');

    await click('[data-test-card-updator-save-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-value]').hasText(`updated body`);

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.body, `updated body`);
  });

  test(`adding a new field to a card`, async function(assert) {
    await login();
    await createCard();
    await visit(`/cards/${card1Id}`);

    await addField('title', 'string', true);

    await click('[data-test-card-updator-save-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-value]').hasText('<no value>')
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');
  });

  test(`deleting a field from a card`, async function(assert) {
    await login();
    await createCard();
    await visit(`/cards/${card1Id}`);

    await removeField('body');

    await click('[data-test-card-updator-save-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-renderer-field="body"]').doesNotExist();
    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.body, undefined);
  });

  test(`updating a card's schema and it's internal model`, async function(assert) {
    await login();
    await createCard();
    await visit(`/cards/${card1Id}`);

    await addField('title', 'string', true, 'Millenial Puppies');

    await click('[data-test-card-updator-save-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-value]').hasText('Millenial Puppies')
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, `Millenial Puppies`);
  });
});