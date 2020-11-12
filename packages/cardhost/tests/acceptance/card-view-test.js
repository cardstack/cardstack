import { module, test } from 'qunit';
import { find, visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForTestsToEnd } from '../helpers/card-ui-helpers';
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
const author2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'mango',
    name: 'Mango',
  })
  .adoptingFrom(author);
const testCard = cardDocument()
  .withAutoAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csFieldSets: {
      embedded: ['title', 'author', 'likes'],
      isolated: ['title', 'author', 'likes', 'body', 'published', 'contributors', 'publishers'],
    },
    title: 'The Millenial Puppy',
    body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.',
    likes: 100,
    published: true,
  })
  .withAttributes({
    publishers: [
      cardDocument()
        .withAttributes({
          csRealm,
          csId: 'jackie',
          csFieldSets: {
            embedded: ['name'],
          },
          name: 'Jackie',
        })
        .withField('name', 'string-field').asCardValue,
      cardDocument()
        .withAttributes({
          csRealm,
          csId: 'wackie',
          csFieldSets: {
            embedded: ['name'],
          },
          name: 'Wackie',
        })
        .withField('name', 'string-field').asCardValue,
    ],
  })
  .withField('contributors', 'base', 'plural')
  .withField('publishers', 'base', 'plural')
  .withAutoRelationships({ author })
  .withRelationships({ contributors: [author2, author] });

const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [testCard, author, author2],
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
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad(testCard.canonicalURL);
    await waitForCardLoad(author.canonicalURL);
    await waitForCardLoad(author2.canonicalURL);

    assert.equal(currentURL(), `/cards/${cardPath}`);
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
    assert.dom(`[data-test-field="contributors"] [data-test-embedded-card]`).exists({ count: 2 });
    assert
      .dom(
        `[data-test-field="contributors"] [data-test-embedded-card="${author2.canonicalURL}"] [data-test-string-field-viewer-value]`
      )
      .hasText('Mango');
    assert.dom(`[data-test-field="publishers"]`).exists();
    assert.dom(`[data-test-field="publishers"] [data-test-embedded-card]`).exists({ count: 2 });
    assert
      .dom(`[data-test-field="publishers"] [data-test-embedded-card] [data-test-string-field-viewer-value]`)
      .hasText('Jackie');

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

    await visit(`/cards/${baseCardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `/cards/${baseCardPath}`);

    assert.dom('[data-test-field]').doesNotExist(); // base-card currenty has no fields
    await percySnapshot(assert);
  });

  test('can navigate to collection view using the header', async function(assert) {
    const org = 'bunny-records';
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-collection-link]').exists();
    assert.dom('[data-test-isolated-collection]').doesNotExist();

    await click('[data-test-collection-link]');
    assert.equal(currentURL(), `/cards/${org}/collection`);
    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-isolated-collection]').exists();
  });

  test('can navigate to collection view using the left-edge', async function(assert) {
    const org = 'bunny-records';
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom(`[data-test-org-switcher="${org}"]`).exists();
    assert.dom('[data-test-isolated-collection]').doesNotExist();

    await click(`[data-test-org-switcher="${org}"]`);
    assert.equal(currentURL(), `/cards/${org}/collection`);
    assert.dom('[data-test-isolated-collection]').exists();
  });
});
