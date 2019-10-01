import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, setCardId } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const card1Id = 'local-hub::article-card::millenial-puppies';
const card2Id = 'local-hub::user-card::van-gogh';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: card1Id },
      { type: 'cards', id: card2Id }
    ];
  }
});

module('Acceptance | create card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('creating a card', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true, 'The Millenial Puppy');
    await addField('author', 'string', true, 'Van Gogh');
    await addField('body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.');

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-updator="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-value]').hasText('The Millenial Puppy');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');

    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-value]').hasText('Van Gogh');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-embedded]').hasText('true');

    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-value]').hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-embedded]').hasText('false');

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, 'The Millenial Puppy');
    assert.equal(card.data.attributes.author, 'Van Gogh');
    assert.equal(card.data.attributes.body, `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
  });

  test('can create a card that has a relationship to another card', async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card2Id);
    await addField('name', 'string', true, 'Van Gogh');
    await addField('email', 'case-insensitive string', false, 'vangogh@nowhere.dog');
    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-updator="${card2Id}"]`);

    await visit('/cards/new');
    await setCardId(card1Id);
    await addField('body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.');
    await addField('author', 'related card', true, card2Id);
    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-updator="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-value]').hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-embedded]').hasText('false');

    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-value]').includesText('{ "type": "cards", "id": "local-hub::user-card::van-gogh" }');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::belongs-to');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-embedded]').hasText('true');

    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: 'local-hub::user-card::van-gogh' });
    let userCard = card.included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
    assert.equal(userCard.attributes.name, 'Van Gogh');
    assert.equal(userCard.attributes.email, undefined);
  });
});
