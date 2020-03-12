import { module, test, skip } from 'qunit';
import { find, visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';
import Fixtures from '../helpers/fixtures';
import {
  setFieldValue,
  saveCard,
  waitForCardLoad,
  encodeColons,
  waitForCardAutosave,
  waitForTestsToEnd,
} from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

const csRealm = `${myOrigin}/api/realms/default`;
const author = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'vangogh',
  name: 'Van Gogh',
});
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldSets: {
      isolated: ['body', 'likes', 'published', 'author', 'appointment', 'birthday', 'link', 'image', 'cta'],
    },
    likes: 100,
    birthday: '2019-10-30',
    appointment: '2020-03-07T14:00:00.000Z',
    body: 'test body',
    published: true,
  })
  .withField('body', 'string-field')
  .withField('likes', 'integer-field')
  .withField('published', 'boolean-field')
  .withField('birthday', 'date-field')
  .withField('appointment', 'datetime-field')
  .withField('link', 'url-field', 'singular', { csTitle: 'Awesome Link' })
  .withField('cta', 'call-to-action-field', 'singular', { csTitle: 'Call to action' })
  .withField('image', 'image-reference-field', 'singular', { csTitle: 'Awesome Image' })
  .withField('author', 'base');
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [author, testCard],
});

module('Acceptance | card edit', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`setting a string field`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields`);

    await setFieldValue('body', 'updated body');
    await saveCard();

    assert.equal(currentURL(), `/cards/${cardPath}/edit/fields`);

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="body"] [data-test-string-field-viewer-value]').hasText(`updated body`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.body, `updated body`);
  });

  test('setting a date field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('birthday', '2016-11-19');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="birthday"] [data-test-date-field-viewer-value]').hasText(`November 19, 2016`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.birthday, `2016-11-19`);
  });

  test('setting a datetime field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('appointment', '2020-03-07T13:00');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert
      .dom('[data-test-field="appointment"] [data-test-datetime-field-viewer-value]')
      .hasText(`March 7, 2020 1:00pm`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.appointment, new Date('2020-03-07T13:00').toISOString());
  });

  test('setting a url field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('link', 'https://cardstack.com');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="link"] [data-test-link-field-viewer-value]').hasText(`Awesome Link`);
    assert
      .dom('[data-test-field="link"] [data-test-link-field-viewer-value]')
      .hasAttribute('href', 'https://cardstack.com/');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.link, 'https://cardstack.com');
  });

  test('setting a call-to-action field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('cta', 'https://cardstack.com');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="cta"] [data-test-cta-field-viewer-value]').hasText(`Call to action`);
    assert
      .dom('[data-test-field="cta"] [data-test-cta-field-viewer-value]')
      .hasAttribute('href', 'https://cardstack.com/');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.cta, 'https://cardstack.com');
  });

  test('setting an image reference field', async function(assert) {
    const imageURL =
      'https://resources.cardstack.com/assets/images/contributors/jen-c80f27e85c9404453b8c65754694619e.jpg';

    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('image', imageURL);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="image"] [data-test-image-reference-field-viewer-label]').hasText(`Awesome Image`);
    assert
      .dom('[data-test-field="image"] [data-test-image-reference-field-viewer-value]')
      .hasAttribute('src', imageURL);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.image, imageURL);
  });

  test('setting an integer field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('likes', 110);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="likes"] [data-test-integer-field-viewer-value]').hasText(`110`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.likes, 110);
  });

  test('setting a boolean field', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('published', false);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="published"] [data-test-boolean-field-viewer-value]').hasText(`No`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.published, false);
  });

  test(`setting a base card field as reference with singular arity`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('author', author.canonicalURL);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForCardLoad(author.canonicalURL);
    assert
      .dom(
        `[data-test-field="author"] [data-test-embedded-card="${author.canonicalURL}"] [data-test-field="name"] [data-test-string-field-viewer-value]`
      )
      .hasText('Van Gogh');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: author.canonicalURL });
  });

  // TODO need UI designs for these
  skip(`setting a base card field as reference with plural arity`, async function() {});
  skip(`setting a card field as value with singular arity`, async function() {});
  skip(`setting a card field as value with plural arity`, async function() {});

  test(`can navigate to view mode using the top edge`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.dom('[data-test-mode-indicator-link="view"]').exists();

    await click('[data-test-mode-indicator-link="view"]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);

    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}/edit/layout`);

    await click('[data-test-mode-indicator-link="view"]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test(`fields mode displays the top edge`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-top-edge-preview-link]').exists();
    assert.dom('[data-test-top-edge-size-buttons]').exists();
    assert.dom('[data-test-top-edge-preview-link]').hasClass('hidden');
    assert.dom('[data-test-top-edge-size-buttons]').hasClass('hidden');
    assert.dom('[data-test-view-selector]').exists();
    assert.dom('[data-test-view-selector="fields"]').hasClass('active');
    assert.dom('[data-test-mode-indicator-link="view"]').exists();
    assert.dom('[data-test-mode-indicator]').containsText('edit mode');
    assert.dom('[data-test-edge-actions-btn]').exists();
    await percySnapshot(assert);
  });

  test(`layout mode displays the top edge with additional controls`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/layout`);
    await waitForCardLoad();

    assert.dom('[data-test-cardhost-top-edge]').exists();
    assert.dom('[data-test-top-edge-preview-link]').exists();
    assert.dom('[data-test-top-edge-size-buttons]').exists();
    assert.dom('[data-test-top-edge-preview-link]').doesNotHaveClass('hidden');
    assert.dom('[data-test-top-edge-size-buttons]').doesNotHaveClass('hidden');
    assert.dom('[data-test-view-selector]').exists();
    assert.dom('[data-test-view-selector="layout"]').hasClass('active');
    assert.dom('[data-test-mode-indicator-link="view"]').exists();
    assert.dom('[data-test-mode-indicator]').containsText('edit mode');
    assert.dom('[data-test-edge-actions-btn]').exists();
    await percySnapshot(assert);
  });

  test(`displays the right edge`, async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.dom('[data-test-right-edge]').exists();
    assert.dom('[data-test-internal-card-id]').doesNotExist();
    assert.dom('[data-test-appearance-section]').doesNotExist();
    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
  });

  test('autosave works', async function(assert) {
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    this.owner.lookup('service:autosave').autosaveDisabled = false;
    await setFieldValue('body', 'this will autosave');
    await waitForCardAutosave();
    this.owner.lookup('service:autosave').autosaveDisabled = true;

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="body"] [data-test-string-field-viewer-value]').hasText(`this will autosave`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.body, `this will autosave`);
  });
});
