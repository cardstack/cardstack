import { module, test, skip } from 'qunit';
import { click, fillIn, find, visit, currentURL, waitFor, triggerEvent } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { addField, setCardId } from '../helpers/card-helpers';
import { setupMockUser, login } from '../helpers/login';

const timeout = 5000;
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
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    await visit(`/cards/${card1Id}/schema`);

    assert.dom('[data-test-field="title"] [data-test-field-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-field="title"] [data-test-field-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-field="title"] .field-renderer--needed-when-embedded-chbx').isChecked();

    assert.dom('[data-test-field="body"] [data-test-field-renderer-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-field="body"] [data-test-field-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-field="body"] .field-renderer--needed-when-embedded-chbx').isNotChecked();

    assert.dom('[data-test-field="author"] [data-test-field-renderer-field-type]').hasText('@cardstack/core-types::belongs-to');
    assert.dom('[data-test-field="author"] [data-test-field-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-field="author"] .field-renderer--needed-when-embedded-chbx').isChecked();

    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-field-type]').hasText('@cardstack/core-types::has-many');
    assert.dom('[data-test-field="reviewers"] [data-test-field-renderer-is-meta]').hasText('true');
    assert.dom('[data-test-field="reviewers"] .field-renderer--needed-when-embedded-chbx').isChecked();

    let card = JSON.parse(find('.code-block').textContent);
    assert.equal(card.data.attributes.title, undefined);
    assert.equal(card.data.attributes.body, undefined);
    assert.equal(card.data.relationships.author, undefined);
    assert.deepEqual(card.data.relationships.reviewers.data, []);
  });

  test(`renaming a card's field`, async function(assert) {
    await login();
    await visit('/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);

    assert.dom('[data-test-field="title"] .field-renderer-field-name-input').hasValue('title');
    await fillIn('[data-test-field="title"] .field-renderer-field-name-input', 'subtitle');
    await triggerEvent(`[data-test-field="title"] .field-renderer-field-name-input`, 'keyup');

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`, { timeout });

    assert.equal(currentURL(), `/cards/${card1Id}`);
    assert.dom('[data-test-field="subtitle"]').exists();
    assert.dom('[data-test-field="title"]').doesNotExist();
  });

  // TODO: un-skip when we add multiple drop zones
  skip('can add a field at a particular position', async function(assert) {
    await login();
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await setCardId(card1Id);
    await addField('title', 'string', true);
    await addField('body', 'string', false);
    await addField('author', 'string', false, 1);

    assert.deepEqual([...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);

    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${card1Id}"]`);

    assert.deepEqual([...document.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);
    let card = JSON.parse(find('.code-block').textContent);
    assert.deepEqual(card.data.relationships.fields.data, [
      { type: 'fields', id: 'title' },
      { type: 'fields', id: 'author' },
      { type: 'fields', id: 'body' },
    ]);
  });
});
