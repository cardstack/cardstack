import { module, test, skip } from 'qunit';
import { find, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { setFieldValue, saveCard, waitForCardLoad, waitForEmbeddedCardLoad } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const author = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'vangogh',
  name: 'Van Gogh',
  csFieldSets: {
    embedded: ['name'],
  },
});
const testCard = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'millenial-puppies',
    csTitle: 'Millenial Puppies',
    csFieldSets: {
      isolated: ['author'],
    },
    likes: 100,
    body: 'test body',
    published: true,
  })
  .withField('body', 'string-field')
  .withField('likes', 'integer-field')
  .withField('published', 'boolean-field')
  .withField('author', 'base');
const cardPath = encodeURIComponent(testCard.canonicalURL);
const scenario = new Fixtures({
  create: [author, testCard],
});

module('Acceptance | card edit', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test(`setting a string field`, async function(assert) {
    await login();
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

  skip('setting a date field', async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('created', '2019-10-08');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    assert.dom('[data-test-field="created"] [data-test-date-field-viewer-value]').hasText(`October 8, 2019`);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.equal(card.data.attributes.created, `2019-10-08`);
  });

  test('setting an integer field', async function(assert) {
    await login();
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
    await login();
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
    await login();
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    await setFieldValue('author', author.canonicalURL);
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForEmbeddedCardLoad(author.canonicalURL);
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

  test(`displays the right edge`, async function(assert) {
    await login();
    await visit(`/cards/${cardPath}/edit/fields`);
    await waitForCardLoad();

    assert.dom('[data-test-right-edge]').exists();
    assert.dom('[data-test-internal-card-id]').doesNotExist();
    assert.dom('[data-test-appearance-section]').doesNotExist();
    assert.dom('[data-test-right-edge] [data-test-adopted-card-name]').hasText('Base Card');
  });
});
