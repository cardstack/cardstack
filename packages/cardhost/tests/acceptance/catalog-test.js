import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForEmbeddedCardLoad, waitForCardLoad } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const template1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'user-template',
    csTitle: 'User Template',
    csCreated: '2020-01-01T14:00:00Z',
  })
  .withField('name', 'string-field')
  .withField('email', 'string-field');
const template2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'article-template',
    csTitle: 'Article Template',
    csCreated: '2020-01-01T16:00:00Z',
  })
  .withField('title', 'string-field')
  .withField('body', 'string-field');
const card1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'hassan',
    csTitle: 'Hassan Abdel-Rahman',
    csFieldSets: {
      embedded: ['name'],
    },
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
    csFieldSets: {
      embedded: ['name'],
    },
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
    csFieldSets: {
      embedded: ['title'],
    },
    csCreated: '2020-01-01T08:00:00Z',
    title: 'The Millenial Puppies of Today',
    body: 'Omg, these puppies are pooping everywhere!',
  })
  .adoptingFrom(template2);
const entry1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'entry1',
    csTitle: 'User Template',
    csDescription: 'This is a template for creating users',
    csCreated: '2020-01-01T17:00:00Z',
    csFieldSets: {
      embedded: ['card'],
    },
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
    csFieldSets: {
      embedded: ['card'],
    },
  })
  .withRelationships({ card: template2 })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'catalog-entry' });

const cards = [entry1, entry2, template1, template2, card1, card2, card3];

const scenario = new Fixtures({
  create: cards,
});

async function waitForCatalogLoad() {
  await Promise.all(cards.map(card => waitForEmbeddedCardLoad(card.canonicalURL)));
}

module('Acceptance | catalog', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });

  test(`viewing catalog`, async function(assert) {
    await visit(`/`);
    await waitForCatalogLoad();

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-recent-cards] [data-test-embedded-card]`)].map(i =>
        i.getAttribute('data-test-embedded-card')
      ),
      [
        entry2.canonicalURL,
        entry1.canonicalURL,
        template2.canonicalURL,
        template1.canonicalURL,
        card1.canonicalURL,
        card2.canonicalURL,
        card3.canonicalURL,
      ]
    );

    assert.deepEqual(
      [...document.querySelectorAll(`[data-test-templates] [data-test-catalog-entry]`)].map(i =>
        i.getAttribute('data-test-embedded-card')
      ),
      [entry2.canonicalURL, entry1.canonicalURL]
    );
    await percySnapshot(assert);
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/`);
    await waitForCatalogLoad();

    await click(`[data-test-card-renderer-embedded="${card2.canonicalURL}"] a`);
    await waitForCardLoad();
    assert.equal(
      currentURL().replace(/:/g, encodeURIComponent(':')),
      `/cards/${encodeURIComponent(card2.canonicalURL)}`
    );

    await percySnapshot(assert);
  });

  test('can navigate to catalog via left edge', async function(assert) {
    await visit(`/cards/${encodeURIComponent(card1.canonicalURL)}`);
    await waitForCardLoad();

    await click('[data-test-library-link]');
    await waitForCatalogLoad();

    assert.equal(currentURL(), '/');
  });
});
