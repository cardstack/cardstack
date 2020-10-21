import { module, test } from 'qunit';
import { click, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForTestsToEnd, encodeColons, waitForThemerLoad } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument } from '@cardstack/hub';
import { percySnapshot } from 'ember-percy';

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

module('Acceptance | card preview', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`previewing a card`, async function(assert) {
    await visit(`/cards/${cardPath}/configure/preview`);
    await waitForCardLoad(testCard.canonicalURL);
    await waitForCardLoad(author.canonicalURL);

    assert.equal(currentURL(), `/cards/${cardPath}/configure/preview`);

    // can render page contents
    assert.dom('[data-test-cardhost-cards]').hasClass('preview');
    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-right-edge]').doesNotExist();
    assert.dom('[data-test-cardhost-left-edge]').doesNotExist();
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-isolated-card-mode="view"]').exists();

    // can render card contents
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

    await percySnapshot(assert);
  });

  test('can navigate to the to previous page (layout) mode when closed', async function(assert) {
    await visit(`/cards/${cardPath}/configure/layout`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/configure/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();

    await click('[data-test-preview-link-btn]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/preview`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-isolated-card-mode="view"]').exists();
    assert.dom('[data-test-mode-indicator-link="preview"]').exists();

    await click('[data-test-mode-indicator]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();
  });

  test('can navigate to the to previous page (themer) when closed', async function(assert) {
    await visit(`/cards/${cardPath}/configure/layout/themer`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/configure/layout/themer`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('themer');

    await click('[data-test-preview-link-btn]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/preview`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('preview');
    assert.dom('[data-test-mode-indicator-link="preview"]').exists();

    await click('[data-test-mode-indicator]');
    await waitForThemerLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/layout/themer`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('themer', 'can return to themer');
  });

  test('can navigate to the to layout page when closed if there is no previous page', async function(assert) {
    await visit(`/cards/${cardPath}/configure/preview`);
    await waitForCardLoad();

    assert.dom('[data-test-mode-indicator-link="preview"]').exists();

    await click('[data-test-mode-indicator]');
    await waitForCardLoad();

    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/configure/layout`);
    assert.dom('[data-test-card-renderer-isolated]').hasClass('layout');
    assert.dom('[data-test-isolated-card-mode="layout"]').exists();
  });
});
