import { module, test, skip } from 'qunit';
import { find, visit, currentURL, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { percySnapshot } from 'ember-percy';
import { animationsSettled } from 'ember-animated/test-support';
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
import { cardDocument } from '@cardstack/hub';

const csRealm = `http://localhost:3000/api/realms/default`;
const author = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'vangogh',
  name: 'Van Gogh',
});
const publisher = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'jackie',
  name: 'Jackie',
});
const publisher2 = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'mango',
  name: 'Mango',
});
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldSets: {
      isolated: [
        'body',
        'likes',
        'published',
        'author',
        'appointment',
        'birthday',
        'link',
        'image',
        'relativeImage',
        'cta',
        'contributors',
        'publishers',
      ],
    },
    likes: 100,
    birthday: '2019-10-30',
    appointment: '2020-03-07T14:00:00.000Z',
    body: 'test body',
    published: true,
  })
  .withField('body', 'string-field', 'singular', { csTitle: 'Body' })
  .withField('likes', 'integer-field', 'singular', { csTitle: 'Likes' })
  .withField('published', 'boolean-field', 'singular', { csTitle: 'Published' })
  .withField('birthday', 'date-field', 'singular', { csTitle: 'Birthday' })
  .withField('appointment', 'datetime-field', 'singular', { csTitle: 'Appointment' })
  .withField('link', 'url-field', 'singular', { csTitle: 'Awesome Link' })
  .withField('cta', 'call-to-action-field', 'singular', { csTitle: 'Call to action' })
  .withField('image', 'image-reference-field', 'singular', { csTitle: 'Awesome Image' })
  .withField('relativeImage', 'relative-image-reference-field', 'singular', { csTitle: 'Awesome Relative Image' })
  .withField('contributors', 'string-field', 'plural', { csTitle: 'Contributors' })
  .withField('author', 'base', 'singular', { csTitle: 'Author' })
  .withField('publishers', 'base', 'plural', { csTitle: 'Publishers' });

const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [author, testCard, publisher, publisher2],
  destroy: [author, testCard, publisher, publisher2],
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
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit`);

    await setFieldValue('body', 'updated body');
    await saveCard();

    assert.equal(currentURL(), `/cards/${cardPath}/edit`);

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="body"] [data-test-string-field-viewer-value]').hasText(`updated body`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.body, `updated body`);
  });

  test('setting a date field', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await setFieldValue('birthday', '2016-11-19');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="birthday"] [data-test-date-field-viewer-value]').hasText(`Nov 19, 2016`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.birthday, `2016-11-19`);
  });

  test('setting a datetime field', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await setFieldValue('appointment', '2020-03-07T13:00');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert
      .dom('[data-test-field="appointment"] [data-test-datetime-field-viewer-value]')
      .hasText(`Mar 7, 2020 1:00 pm`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.appointment, new Date('2020-03-07T13:00').toISOString());
  });

  test('setting a url field', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await setFieldValue('link', 'https://cardstack.com');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();

    assert.dom('[data-test-field="link"] [data-test-link-field-viewer-label]').hasText(`Awesome Link`);
    assert.dom('[data-test-field="link"] [data-test-link-field-viewer-value]').hasText(`https://cardstack.com/`);
    assert
      .dom('[data-test-field="link"] [data-test-link-field-viewer-value]')
      .hasAttribute('href', 'https://cardstack.com/');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.link, 'https://cardstack.com');
  });

  test('setting a call-to-action field', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
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

    await visit(`/cards/${cardPath}/edit`);
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

  test('setting a relative image reference field', async function(assert) {
    const imageURL = '/assets/images/contributors/jen-c80f27e85c9404453b8c65754694619e.jpg';

    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await setFieldValue('relativeImage', imageURL);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert
      .dom('[data-test-field="relativeImage"] [data-test-image-reference-field-viewer-label]')
      .hasText(`Awesome Relative Image`);
    assert
      .dom('[data-test-field="relativeImage"] [data-test-image-reference-field-viewer-value]')
      .hasAttribute('src', imageURL);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes['relativeImage'], imageURL);
  });

  test('setting an integer field', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
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
    await visit(`/cards/${cardPath}/edit`);
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
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await click('[data-test-edit-field="author"] [data-test-embedded-card-add-btn]');
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

  test(`setting a string field with plural arity`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.dom(`[data-test-edit-field="contributors"]`).exists();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist]`).exists();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).doesNotExist();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-add-btn]`).exists();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-add-input]`).doesNotExist();

    await click('[data-test-edit-field="contributors"] [data-test-taglist-add-btn]');
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-add-input]`).exists();

    await setFieldValue('contributors', 'Jackie');
    await setFieldValue('contributors', 'Mango');

    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).exists({ count: 2 });
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();

    assert.dom(`[data-test-field="contributors"] [data-test-string-field-viewer-value]`).hasText('Jackie, Mango');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.contributors, ['Jackie', 'Mango']);
  });

  test(`editing a string field with plural arity`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    await click('[data-test-edit-field="contributors"] [data-test-taglist-add-btn]');
    await setFieldValue('contributors', 'Van Gogh');
    await setFieldValue('contributors', 'Mango');
    await setFieldValue('contributors', 'Jackie');

    assert.dom(`[data-test-edit-field="contributors"]`).exists();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist]`).exists();
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).exists({ count: 3 });
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-add-btn]`).exists();

    await click('[data-test-edit-field="contributors"] [data-test-taglist-remove-btn="0"]');
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).exists({ count: 2 });

    await click('[data-test-edit-field="contributors"] [data-test-taglist-remove-btn="1"]');
    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).exists({ count: 1 });

    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-add-input]`).exists();

    await setFieldValue('contributors', 'Jackie');

    assert.dom(`[data-test-edit-field="contributors"] [data-test-taglist-item]`).exists({ count: 2 });
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();

    assert.dom(`[data-test-field="contributors"] [data-test-string-field-viewer-value]`).hasText('Mango, Jackie');

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.attributes.contributors, ['Mango', 'Jackie']);
  });

  // TODO
  skip(`setting a base card field as reference with plural arity`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.dom(`[data-test-edit-field="publishers"]`).exists();
    assert.dom(`[data-test-edit-field="publishers"] [data-test-has-many]`).exists();
    assert.dom(`[data-test-edit-field="publishers"] [data-test-card-renderer-embedded]`).doesNotExist();
    assert.dom(`[data-test-edit-field="publishers"] [data-test-has-many-add-btn]`).exists();
    assert.dom(`[data-test-edit-field="publishers"] [data-test-has-many-input]`).doesNotExist();

    await click(`[data-test-edit-field="publishers"] [data-test-has-many-add-btn]`);
    assert.dom(`[data-test-edit-field="publishers"] [data-test-has-many-input]`).exists();

    await setFieldValue('publishers', publisher.canonicalURL);
    assert.dom(`[data-test-edit-field="publishers"] [data-test-card-renderer-embedded]`).exists({ count: 1 });
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForCardLoad(publisher.canonicalURL);
    assert.dom(`[data-test-field="publishers"] [data-test-card-renderer-embedded]`).exists({ count: 1 });

    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();
    await click(`[data-test-edit-field="publishers"] [data-test-has-many-add-btn]`);
    await setFieldValue('publishers', publisher2.canonicalURL);
    assert.dom(`[data-test-edit-field="publishers"] [data-test-card-renderer-embedded]`).exists({ count: 2 });
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForCardLoad(publisher2.canonicalURL);

    assert.dom(`[data-test-field="publishers"] [data-test-card-renderer-embedded]`).exists({ count: 2 });
  });

  skip(`editing a base card field as reference with plural arity`, async function() {});
  skip(`setting a card field as value with singular arity`, async function() {});
  skip(`setting a card field as value with plural arity`, async function() {});
  skip(`setting an image card field with plural arity`, async function() {});
  skip(`setting a dropdown field`, async function() {});
  skip(`setting an audio card field with singular arity`, async function() {});
  skip(`setting an audio card field with plural arity`, async function() {});
  skip(`edit cards with sections are displayed correctly`, async function() {});

  test(`can navigate to view mode using the mode button`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.dom('[data-test-mode-indicator-link="edit"]').exists();

    await click('[data-test-mode-indicator-link="edit"]');
    await waitForCardLoad();
    assert.equal(encodeColons(currentURL()), `/cards/${cardPath}`);
  });

  test(`does not display the top or right edge`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();
    await animationsSettled();

    assert.dom('[data-test-cardhost-top-edge]').doesNotExist();
    assert.dom('[data-test-right-edge]').doesNotExist();
    await percySnapshot(assert);
  });

  test('autosave works', async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
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
