import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setFieldValue, createCards } from '../helpers/card-helpers';
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

module('Acceptance | card edit', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test(`updating a card's attribute-type field value`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/edit`);
    assert.equal(currentURL(), `/cards/${card1Id}/edit`);

    await setFieldValue('body', 'updated body');

    await click('[data-test-card-editor-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-value]').hasText(`updated body`);

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.body, `updated body`);
  });

  test(`setting a card relationship`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['author', 'related card', true],
        ['reviewers', 'related cards', true],
        ['body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.'],
      ],
      [card2Id]: [
        ['name', 'string', true, 'Van Gogh'],
        ['email', 'case-insensitive string', false, 'vangogh@nowhere.dog'],
      ]
    });
    await visit(`/cards/${card1Id}/edit`);

    await setFieldValue('author', card2Id);
    await setFieldValue('reviewers', [card2Id]);

    await click('[data-test-card-editor-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-value]').includesText(`<card ${card2Id}>`);
    assert.dom('[data-test-card-renderer-field="reviewers"] [data-test-card-renderer-value]').includesText(`<card ${card2Id}>`);

    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: 'local-hub::user-card::van-gogh' });
    assert.deepEqual(card.data.relationships.reviewers.data, [{ type: 'cards', id: 'local-hub::user-card::van-gogh' }]);
    let userCard = card.included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
    assert.equal(userCard.attributes.name, 'Van Gogh');
    assert.equal(userCard.attributes.email, undefined);
  });


  test(`deleting a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['body', 'string', false, 'test body']
      ]
    });
    await visit(`/cards/${card1Id}/edit`);

    await click('[data-test-card-editor-delete-btn]');
    await waitFor('a[href="/cards/new"]');

    await visit(`/cards/${card1Id}`);
    assert.dom('h2').includesText('Not Found');
  });
});