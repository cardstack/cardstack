import { module, test } from 'qunit';
import { click, find, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, setCardId } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const card1Id = 'local-hub::article-card::millenial-puppies';

const scenario = new Fixtures({
  create(factory) {
    setupMockUser(factory);
  },
  destroy() {
    return [
      { type: 'cards', id: card1Id },
    ];
  }
});

module('Acceptance | card create', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('creating a card', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false);
    await addField('author', 'related card', true);
    await addField('reviewers', 'related cards', true);

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-value]').hasText('<no value>');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="title"] [data-test-card-renderer-embedded]').hasText('true');

    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-value]').hasText(`<no value>`);
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="body"] [data-test-card-renderer-embedded]').hasText('false');

    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-value]').includesText(`<no value>`);
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::belongs-to');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="author"] [data-test-card-renderer-embedded]').hasText('true');

    assert.dom('[data-test-card-renderer-field="reviewers"] [data-test-card-renderer-value]').includesText(`<no value>`);
    assert.dom('[data-test-card-renderer-field="reviewers"] [data-test-card-renderer-field-type]').hasText('@cardstack/core-types::has-many');
    assert.dom('[data-test-card-renderer-field="reviewers"] [data-test-card-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-card-renderer-field="reviewers"] [data-test-card-renderer-embedded]').hasText('true');

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.deepEqual(card.data.relationships.reviewers.data, []);
  });

  test('can add a field at a particular position', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false);
    await addField('author', 'string', false, 1);

    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['title', 'author', 'body']);

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.deepEqual([...document.querySelectorAll('[data-test-card-renderer-field]')].map(i => i.getAttribute('data-test-card-renderer-field')),
      ['title', 'author', 'body']);
    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'title' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'body' },
    ]);
  });
});
