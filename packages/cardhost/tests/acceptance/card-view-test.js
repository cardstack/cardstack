import { module, test } from 'qunit';
import { find, visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForTestsToEnd,
  CARDS_URL,
  DEFAULT_ORG,
  DEFAULT_COLLECTION,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { canonicalURL } from '@cardstack/hub';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

const csRealm = `http://localhost:3000/api/realms/default`;
const author = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'van-gogh',
  csFieldSets: {
    embedded: ['name'],
    isolated: ['name', 'email'],
  },
  name: 'Van Gogh',
  email: 'vangogh@nowhere.dog',
});
const testCard = cardDocument()
  .withAutoAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csFieldSets: {
      embedded: ['title', 'author', 'likes'],
      isolated: ['title', 'author', 'likes', 'body', 'published'],
    },
    title: 'The Millenial Puppy',
    body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
    likes: 100,
    published: true,
  })
  .withAutoRelationships({ author });
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, author],
});

module('Acceptance | card view', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`viewing a card`, async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad(testCard.canonicalURL);
    await waitForCardLoad(author.canonicalURL);

    assert.equal(currentURL(), `${CARDS_URL}/${cardPath}`);
    assert.dom('[data-test-field="title"] [data-test-string-field-viewer-value]').hasText('The Millenial Puppy');
    assert
      .dom('[data-test-field="body"] [data-test-string-field-viewer-value]')
      .hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert
      .dom(
        `[data-test-field="author"] [data-test-embedded-card="${author.canonicalURL}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Van Gogh');
    assert
      .dom(`[data-test-field="author"] [data-test-embedded-card="${author.canonicalURL}"] [data-test-field="email"]`)
      .doesNotExist();

    assert.dom('[data-test-right-edge]').doesNotExist();
    assert.dom('[data-test-internal-card-id]').doesNotExist();

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.title, 'The Millenial Puppy');
    assert.equal(
      card.data.attributes.body,
      `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`
    );
    assert.equal(card.data.attributes.likes, 100);
    assert.equal(card.data.attributes.published, true);
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: author.canonicalURL });

    await percySnapshot(assert);
  });

  test('can navigate to the base-card', async function(assert) {
    let baseCardPath = encodeURIComponent(canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }));

    await visit(`${CARDS_URL}/${baseCardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `${CARDS_URL}/${baseCardPath}`);

    assert.dom('[data-test-field]').doesNotExist(); // base-card currenty has no fields
    await percySnapshot(assert);
  });

  test('can navigate to collection view using the header', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-collection-link]').exists();
    assert.dom('[data-test-isolated-collection]').doesNotExist();

    await click('[data-test-collection-link]');
    assert.equal(currentURL(), `${CARDS_URL}/collection/${DEFAULT_COLLECTION}`);
    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-isolated-collection]').exists();
  });

  test('can navigate to collection view using the left-edge', async function(assert) {
    await visit(`${CARDS_URL}/${cardPath}`);
    await waitForCardLoad();
    assert.dom(`[data-test-org-switcher="${DEFAULT_ORG}"]`).exists();
    assert.dom('[data-test-isolated-collection]').doesNotExist();

    await click(`[data-test-org-switcher="${DEFAULT_ORG}"]`);
    assert.equal(currentURL(), `${CARDS_URL}/collection/${DEFAULT_COLLECTION}`);
    assert.dom('[data-test-isolated-collection]').exists();
  });
});
