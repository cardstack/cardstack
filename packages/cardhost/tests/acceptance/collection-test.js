import { module, test } from 'qunit';
import { click, visit, currentURL, find } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, encodeColons, waitForTestsToEnd } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';
import { embeddedCssFile } from '@cardstack/cardhost/utils/scaffolding';

const csRealm = `http://localhost:3000/api/realms/default`;
const template = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'collection-template',
    csTitle: 'Template',
    csCreated: '2020-01-01T14:00:00Z',
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
  })
  .withField('name', 'string-field')
  .withField('email', 'string-field');
const card1 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'collection-hassan',
    csTitle: 'Master Recording',
    csCreated: '2020-01-01T10:00:00Z',
    name: 'Hassan Abdel-Rahman',
    email: 'hassan@nowhere.dog',
  })
  .adoptingFrom(template);
const card2 = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'collection-van-gogh',
    csTitle: 'Master Recording',
    csCreated: '2020-01-01T09:00:00Z',
    name: 'Van Gogh',
    email: 'vangogh@nowhere.dog',
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
    await visit(`/cards/collection`);
    await waitForCollectionLoad();
    assert.equal(currentURL(), '/cards/collection');

    assert.dom('[data-test-org-header]').exists();
    assert.dom('[data-test-cardhost-left-edge]').exists();
    assert.dom('[data-test-isolated-collection]').exists();
    assert.dom('[data-test-isolated-collection-card]').exists({ count: 2 });

    await percySnapshot(assert);
  });

  test('card embedded css is rendered for the cards in the collection', async function(assert) {
    await visit(`/cards/collection`);
    await waitForCollectionLoad();

    assert.ok(
      find(`[data-test-css-format="embedded"]`).innerText.includes('template css'),
      'embedded card style is correct'
    );
  });

  test(`isolating a card`, async function(assert) {
    await visit(`/cards/collection`);
    await waitForCollectionLoad();

    await click(`[data-test-card-renderer="${card2.canonicalURL}"] a`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${encodeURIComponent(card2.canonicalURL)}`);
    assert.dom(`[data-test-card-renderer-isolated="${card2.canonicalURL}"]`).exists();

    await percySnapshot(assert);
  });
});
