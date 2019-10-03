import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { createCards } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const card1Id = 'local-hub::article-card::millenial-puppies';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [{ type: 'cards', id: card1Id }];
  }
});

module('Acceptance | card view', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test(`viewing a card`, async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'string', true, 'Van Gogh'],
        ['body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.']
      ]
    });
    await visit(`/cards/${card1Id}`);

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

  test('can navigate to edit card', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'string', true, 'Van Gogh'],
        ['body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.']
      ]
    });
    await visit(`/cards/${card1Id}`);

    await click(`a[href="/cards/${card1Id}/edit"]`);
    await waitFor(`[data-test-card-edit="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}/edit`);
  });

  test('can navigate to card schema', async function(assert) {
    await login();
    await createCards({
      [card1Id]: [
        ['title', 'string', true, 'The Millenial Puppy'],
        ['author', 'string', true, 'Van Gogh'],
        ['body', 'string', false, 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.']
      ]
    });
    await visit(`/cards/${card1Id}`);

    await click(`a[href="/cards/${card1Id}/schema"]`);
    await waitFor(`[data-test-card-schema="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}/schema`);
  });
});