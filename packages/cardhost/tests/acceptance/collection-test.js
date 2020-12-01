import { module, test, skip } from 'qunit';
import { click, visit, currentURL, find } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, encodeColons, waitForTestsToEnd } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { embeddedCssFile } from '@cardstack/cardhost/utils/scaffolding';

const csRealm = `http://localhost:3000/api/realms/default`;
const org = 'bunny-records';
const template = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'template',
    csFieldSets: {
      embedded: ['name'],
      isolated: ['name', 'email'],
    },
    csFeatures: { 'embedded-css': embeddedCssFile },
    csFiles: {
      [embeddedCssFile]: 'template css',
    },
    name: 'Sample User',
    email: 'user@nowhere.dog',
    csTitle: 'Master Recording',
  })
  .withField('name', 'string-field', 'singular', { csTitle: 'Name' })
  .withField('email', 'string-field', 'singular', { csTitle: 'Email' });
const card1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'hassan',
    name: 'Hassan Abdel-Rahman',
    email: 'hassan@nowhere.dog',
    csTitle: 'Master Recording',
  })
  .adoptingFrom(template);
const card2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'van-gogh',
    name: 'Van Gogh',
    email: 'vangogh@nowhere.dog',
    csTitle: 'Musical Work',
  })
  .adoptingFrom(template);

const scenario = new Fixtures({
  create: [template, card1, card2],
});

async function waitForCollectionLoad() {
  await Promise.all([card1, card2].map(card => waitForCardLoad(card.canonicalURL)));
}

module('Acceptance | collection', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`viewing collection`, async function(assert) {
    await visit(`/cards/default/collection`);
    await waitForCollectionLoad();
    assert.equal(currentURL(), `/cards/default/collection`);

    assert.dom('[data-test-org-header]').doesNotExist();
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom(`[data-test-org-switcher="${org}"]`).exists();
    assert.dom('[data-test-isolated-collection]').exists();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 3 });

    await percySnapshot(assert);
  });

  test(`viewing org collection`, async function(assert) {
    await visit('/');
    assert.equal(currentURL(), `/cards/${org}/collection/master-recording`);

    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom(`[data-test-org-switcher="${org}"]`).exists();
    assert.dom('[data-test-isolated-collection]').exists();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });

    await percySnapshot(assert);
  });

  test(`navigating to user's default cards collection`, async function(assert) {
    await visit(`/cards`);
    assert.equal(currentURL(), `/cards/${org}/collection/master-recording`);

    await click('[data-test-user-cards-button]');
    await waitForCollectionLoad();
    assert.equal(currentURL(), `/cards/default/collection`);

    assert.dom('[data-test-org-header]').doesNotExist();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 3 });
  });

  test('card embedded css is rendered for the cards in the collection', async function(assert) {
    await visit(`/cards/default/collection`);
    await waitForCollectionLoad();

    assert.ok(
      find(`[data-test-css-format="embedded"]`).innerText.includes('template css'),
      'embedded card style is correct'
    );
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/cards/default/collection`);
    await waitForCollectionLoad();

    await click(`[data-test-card-renderer="${card2.canonicalURL}"] a`);
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card2.canonicalURL)}`);
    assert.dom(`[data-test-card-renderer-isolated="${card2.canonicalURL}"]`).exists();

    await percySnapshot(assert);
  });

  test(`can switch collection view using the left edge and header tabs`, async function(assert) {
    const org1 = 'bunny-records';
    const title1 = 'Bunny Records';
    const collection1 = 'master-recording';
    const collectionTitle1 = 'Master Recordings';
    const org2 = 'warner-chappell-music';
    const title2 = 'Warner Chappell Music';
    const collection2 = 'musical-work';
    const collectionTitle2 = 'Musical Works';

    await visit(`/cards/${org1}/collection`);
    assert.equal(currentURL(), `/cards/${org1}/collection`);

    assert.dom(`[data-test-org-switcher=${org1}]`).exists();
    assert.dom(`[data-test-org-switcher=${org1}]`).hasClass('active');
    assert.dom('[data-test-org-header] h1').hasText(title1);

    assert.dom(`[data-test-org-header-link=${collection1}]`).exists();
    assert.dom(`[data-test-org-header-link=${collection1}]`).doesNotHaveClass('active');
    assert
      .dom(`[data-test-org-header-link=${collection1}]`)
      .hasAttribute('href', `/cards/${org1}/collection/${collection1}`);
    assert.dom('[data-test-isolated-collection] h2').hasText('');
    assert.dom('[data-test-isolated-collection-count]').hasText('3');

    await click(`[data-test-org-header-link=${collection1}]`);
    assert.equal(currentURL(), `/cards/${org1}/collection/${collection1}`);

    assert.dom('[data-test-isolated-collection] h2').hasText(collectionTitle1);
    assert.dom(`[data-test-org-switcher=${org1}]`).hasClass('active');
    assert.dom(`[data-test-org-header-link=${collection1}]`).hasClass('active');
    assert.dom('[data-test-isolated-collection-count]').hasText('2');

    assert.dom(`[data-test-org-switcher=${org2}]`).exists();
    assert.dom(`[data-test-org-switcher=${org2}]`).doesNotHaveClass('active');
    assert.dom(`[data-test-org-header-link=${collection2}]`).doesNotExist();

    await click(`[data-test-org-switcher=${org2}]`);
    assert.equal(currentURL(), `/cards/${org2}/collection`);

    assert.dom(`[data-test-org-switcher=${org2}]`).hasClass('active');
    assert.dom('[data-test-org-header] h1').hasText(title2);
    assert.dom(`[data-test-org-header-link=${collection2}]`).exists();
    assert
      .dom(`[data-test-org-header-link=${collection2}]`)
      .hasAttribute('href', `/cards/${org2}/collection/${collection2}`);

    assert.dom(`[data-test-org-switcher=${org1}]`).exists();
    assert.dom(`[data-test-org-switcher=${org1}]`).doesNotHaveClass('active');
    assert.dom(`[data-test-org-header-link=${collection1}]`).doesNotExist();

    await click(`[data-test-org-header-link=${collection2}]`);
    assert.equal(currentURL(), `/cards/${org2}/collection/${collection2}`);

    assert.dom('[data-test-isolated-collection] h2').hasText(collectionTitle2);
    assert.dom(`[data-test-org-switcher=${org2}]`).hasClass('active');
    assert.dom(`[data-test-org-header-link=${collection2}]`).hasClass('active');
    assert.dom('[data-test-isolated-collection-count]').hasText('1');

    await percySnapshot(assert);

    await click(`[data-test-org-switcher="${org1}"]`);
    assert.equal(currentURL(), `/cards/${org1}/collection`);
    assert.dom('[data-test-org-header] h1').hasText(title1);
    assert.dom('[data-test-isolated-collection] h2').hasText('');
  });

  skip(`can render table view`, async function() {});
  skip(`can render list view`, async function() {});
  skip(`can search collection`, async function() {});
  skip(`can sort collection`, async function() {});
  skip(`can filter collection`, async function() {});
});
