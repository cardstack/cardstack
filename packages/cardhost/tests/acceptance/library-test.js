import { module, test } from 'qunit';
import { click, visit, currentURL, find } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import {
  waitForCardLoad,
  waitForCatalogEntriesToLoad,
  encodeColons,
  waitForTestsToEnd,
  waitForSchemaViewToLoad,
  waitForLibraryServiceToIdle,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { embeddedCssFile, isolatedCssFile } from '@cardstack/cardhost/utils/scaffolding';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { canonicalURL } from '@cardstack/core/card-id';
import get from 'lodash/get';

const csRealm = `${myOrigin}/api/realms/default`;
const template1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'user-template',
    csTitle: 'User Template',
    csCreated: '2020-01-01T14:00:00Z',
    csFieldSets: {
      embedded: ['name'],
      isolated: ['name', 'email'],
    },
    csFeatures: { 'embedded-css': embeddedCssFile },
    csFiles: {
      [embeddedCssFile]: 'template1 css',
    },
    name: 'Sample User',
    email: 'user@nowhere.dog',
  })
  .withField('name', 'string-field')
  .withField('email', 'string-field');
const template2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'article-template',
    csTitle: 'Article Template',
    csCreated: '2020-01-01T16:00:00Z',
    csFieldSets: {
      embedded: ['title'],
      isolated: ['title', 'body'],
    },
    csFeatures: { 'embedded-css': embeddedCssFile },
    csFiles: {
      [embeddedCssFile]: 'template2 css',
    },
    title: 'Sample Article',
    body: 'Lorem ipsum',
  })
  .withField('title', 'string-field')
  .withField('body', 'string-field');
const card1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'hassan',
    csTitle: 'Hassan Abdel-Rahman',
    csCreated: '2020-01-01T10:00:00Z',
    name: 'Hassan Abdel-Rahman',
    email: 'hassan@nowhere.dog',
  })
  .adoptingFrom(template1);
const card2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'van-gogh',
    csTitle: 'Van Gogh',
    csCreated: '2020-01-01T09:00:00Z',
    name: 'Van Gogh',
    email: 'vangogh@nowhere.dog',
  })
  .adoptingFrom(template1);
const card3 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppy',
    csTitle: 'The Millenial Puppy',
    csCreated: '2020-01-01T08:00:00Z',
    csFeatures: { 'isolated-css': isolatedCssFile },
    csFiles: {
      [isolatedCssFile]: 'card3 isolated css',
    },
    title: 'The Millenial Puppies of Today',
    body: 'Omg, these puppies are pooping everywhere!',
  })
  .adoptingFrom(template2);
const card4 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'why-doors',
    csTitle: 'Why Doors?',
    csCreated: '2020-01-01T07:00:00Z',
    csFeatures: { 'isolated-css': isolatedCssFile },
    csFiles: {
      [isolatedCssFile]: 'card4 isolated css',
    },
    title: 'Why Doors?',
    body: "What's the deal with doors?",
  })
  .adoptingFrom(template2);
const entry1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry1',
    csTitle: 'User Template',
    csDescription: 'This is a template for creating users',
    csCreated: '2020-01-01T17:00:00Z',
    type: 'template',
  })
  .withRelationships({ card: template1 })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const entry2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry2',
    csTitle: 'Article Template',
    csDescription: 'This is a template for creating articles',
    csCreated: '2020-01-01T18:00:00Z',
    type: 'template',
  })
  .withRelationships({ card: template2 })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const entry3 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry3',
    csTitle: 'Featured: The Millenial Puppy',
    csDescription: 'This super hot article about these puppies that are pooping all over the place.',
    csCreated: '2020-01-01T19:00:00Z',
    type: 'featured',
  })
  .withRelationships({ card: card3 })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });
const entry4 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry4',
    csTitle: 'Featured: Why Doors?',
    csDescription: 'This is a breaking investigative piece about the supremecy of doors in our society.',
    csCreated: '2020-01-01T20:00:00Z',
    type: 'featured',
  })
  .withRelationships({ card: card4 })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });

const cards = [entry1, entry2, entry3, entry4, template1, template2, card1, card2, card3, card4];
const featuredCards = [card3, card4];
const cardsSortedByCreatedDescending = [template2, template1, card1, card2, card3, card4];

function filterRealmCards(cardIds) {
  return cardIds.filter(
    i =>
      i !== 'http://localhost:3000/api/realms/meta/cards/http%3A%2F%2Flocalhost%3A3000%2Fapi%2Frealms%2Fdefault' &&
      i !== 'http://localhost:3000/api/realms/meta/cards/http%3A%2F%2Flocalhost%3A3000%2Fapi%2Frealms%2Fmeta'
  );
}

function nonCatalogEntries(cards) {
  return cards.filter(
    card =>
      get(card, `jsonapi.data.relationships.csAdoptsFrom.data.id`) !==
      canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' })
  );
}

const scenario = new Fixtures({
  create: cards,
});

async function waitForLibraryLoad() {
  await waitForLibraryServiceToIdle();
  await waitForCatalogEntriesToLoad('[data-test-templates]');
  await Promise.all(nonCatalogEntries(cards).map(card => waitForCardLoad(card.canonicalURL)));
}
async function waitForFeaturedCardsLoad() {
  await waitForCatalogEntriesToLoad('[data-test-featured-cards]');
  await Promise.all(featuredCards.map(card => waitForCardLoad(card.canonicalURL)));
}

module('Acceptance | library', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`viewing library`, async function(assert) {
    await visit(`/`);
    assert.equal(currentURL(), '/cards');

    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    assert.dom('[data-test-library]').exists();

    assert.deepEqual(
      filterRealmCards(
        [
          ...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`),
        ].map(i => i.getAttribute('data-test-card-renderer-embedded'))
      ),
      cardsSortedByCreatedDescending.map(c => c.canonicalURL)
    );

    for (let entry of [entry1, entry2, entry3, entry4]) {
      assert.equal(
        [...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`)]
          .map(i => i.getAttribute('data-test-card-renderer-embedded'))
          .includes(entry.canonicalURL),
        false,
        'catalog entry card does not appear in recent cards'
      );
    }

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-templates] [data-test-library-adopt-card-btn]`)].map(i =>
        i.getAttribute('data-test-library-adopt-card-btn')
      ),
      [template2.canonicalURL, template1.canonicalURL]
    );
    await percySnapshot(assert);

    // we are testing to make sure we honor the embedded card occlusion rules
    // (and that these rules are inherited in the adoption chain and honored by
    // the catalog entry wrappers)
    assert
      .dom(
        `[data-test-templates] [data-test-card-renderer-embedded="${template1.canonicalURL}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Sample User');
    assert
      .dom(
        `[data-test-templates] [data-test-card-renderer-embedded="${template1.canonicalURL}"] [data-test-field="email"]`
      )
      .doesNotExist();
    assert
      .dom(
        `[data-test-library-recent-card-link] > [data-test-card-renderer-embedded="${card1.canonicalURL}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Hassan Abdel-Rahman');
    assert
      .dom(
        `[data-test-library-recent-card-link] > [data-test-card-renderer-embedded="${card1.canonicalURL}"] [data-test-field="email"]`
      )
      .doesNotExist();
  });

  test('card embedded css is rendered for the cards in the library', async function(assert) {
    await visit(`/`);
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    assert.ok(
      find(
        `[data-test-css-format="embedded"][data-test-css-cards="[${card1.canonicalURL},${template1.canonicalURL},${card2.canonicalURL}]"]`
      ).innerText.includes('template1 css'),
      'embedded card style is correct'
    );
    assert.ok(
      find(
        `[data-test-css-format="embedded"][data-test-css-cards="[${template2.canonicalURL},${card3.canonicalURL},${card4.canonicalURL}]"]`
      ).innerText.includes('template2 css'),
      'embedded card style is correct'
    );
  });

  test('featured cards are displayed', async function(assert) {
    await visit(`/`);
    await waitForFeaturedCardsLoad();

    await percySnapshot(assert);
    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-featured-card]`)].map(i => i.getAttribute('data-test-featured-card')),
      [card4.canonicalURL, card3.canonicalURL]
    );
    assert.dom(`[data-test-featured-card="${card3.canonicalURL}"] [data-test-isolated-card]`).exists();
    assert.dom(`[data-test-featured-card="${card4.canonicalURL}"] [data-test-isolated-card]`).exists();
    assert
      .dom(`[data-test-featured-card="${card3.canonicalURL}"] [data-test-featured-card-title]`)
      .hasText('Featured: The Millenial Puppy');
    assert
      .dom(`[data-test-featured-card="${card4.canonicalURL}"] [data-test-featured-card-title]`)
      .hasText('Featured: Why Doors?');
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${card3.canonicalURL}]"`).innerText.includes(
        'card3 isolated css'
      ),
      'featured card style is correct'
    );
    assert.ok(
      find(`[data-test-css-format="isolated"][data-test-css-cards="[${card4.canonicalURL}]"`).innerText.includes(
        'card4 isolated css'
      ),
      'featured card style is correct'
    );
  });

  test(`closing library panel`, async function(assert) {
    await visit(`/`);
    await click('[data-test-library-button]');
    await animationsSettled();

    assert.dom('[data-test-library]').exists();
    await click('[data-test-library-close-button]');
    assert.dom('[data-test-library]').doesNotExist();
  });

  test('visit library from card view', async function(assert) {
    await visit(`/cards/${encodeURIComponent(card1.canonicalURL)}`);
    await waitForCardLoad();

    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    assert.equal(currentURL(), `/cards/${encodeURIComponent(card1.canonicalURL)}`);
    assert.dom('[data-test-library]').exists();
    assert.deepEqual(
      filterRealmCards(
        [
          ...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`),
        ].map(i => i.getAttribute('data-test-card-renderer-embedded'))
      ),
      cardsSortedByCreatedDescending.map(c => c.canonicalURL)
    );
  });

  test('visit library from card edit', async function(assert) {
    await visit(`/cards/${encodeURIComponent(card1.canonicalURL)}/edit/fields`);
    await waitForCardLoad();

    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    assert.equal(currentURL(), `/cards/${encodeURIComponent(card1.canonicalURL)}/edit/fields`);
    assert.dom('[data-test-library]').exists();
    assert.deepEqual(
      filterRealmCards(
        [
          ...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`),
        ].map(i => i.getAttribute('data-test-card-renderer-embedded'))
      ),
      cardsSortedByCreatedDescending.map(c => c.canonicalURL)
    );
  });

  test('visit library from card schema', async function(assert) {
    await visit(`/cards/${encodeURIComponent(card1.canonicalURL)}/edit/fields/schema`);
    await waitForSchemaViewToLoad();

    assert.dom('[data-test-library-button]').exists();
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    assert.equal(currentURL(), `/cards/${encodeURIComponent(card1.canonicalURL)}/edit/fields/schema`);
    assert.dom('[data-test-library]').exists();
    assert.deepEqual(
      filterRealmCards(
        [
          ...document.querySelectorAll(`[data-test-library-recent-card-link] > [data-test-card-renderer-embedded]`),
        ].map(i => i.getAttribute('data-test-card-renderer-embedded'))
      ),
      cardsSortedByCreatedDescending.map(c => c.canonicalURL)
    );
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/cards`);
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    await click(`[data-test-library-recent-card-link="${card2.canonicalURL}"]`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card2.canonicalURL)}`);

    await percySnapshot(assert);
  });

  test(`can use library to view card from /cards route`, async function(assert) {
    await visit(`/cards`);
    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    await click(`[data-test-library-recent-card-link="${card3.canonicalURL}"]`);
    assert.dom('[data-test-library]').doesNotExist();
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card3.canonicalURL)}`);
    assert.dom(`[data-test-isolated-card="${card3.canonicalURL}"]`).exists();
  });

  test(`can use library to view card from a specific card view route`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(card1.canonicalURL)}`);
    await waitForCardLoad();

    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    await click(`[data-test-library-recent-card-link="${card3.canonicalURL}"]`);
    assert.dom('[data-test-library]').doesNotExist();
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card3.canonicalURL)}`);
    assert.dom(`[data-test-isolated-card="${card3.canonicalURL}"]`).exists();
  });

  test(`can use library to view current card`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(card3.canonicalURL)}`);
    await waitForCardLoad();

    await click('[data-test-library-button]');
    await waitForLibraryLoad();

    await click(`[data-test-library-recent-card-link="${card3.canonicalURL}"]`);
    assert.dom('[data-test-library]').doesNotExist();
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card3.canonicalURL)}`);
    assert.dom(`[data-test-isolated-card="${card3.canonicalURL}"]`).exists();
  });
});
