import { module, test } from 'qunit';
import { find, visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForEmbeddedCardLoad } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/core/card-document';
import { myOrigin } from '@cardstack/core/origin';
import { canonicalURL } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const csRealm = `${myOrigin}/api/realms/first-ephemeral-realm`;
const author = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'van-gogh',
  csFieldSets: {
    embedded: ['name'],
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

  test(`viewing a card`, async function(assert) {
    await login();
    await visit(`/cards/${cardPath}`);
    await waitForCardLoad();
    await waitForEmbeddedCardLoad(author.canonicalURL);

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
    await login();
    let baseCardPath = encodeURIComponent(canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }));

    await visit(`/cards/${baseCardPath}`);
    await waitForCardLoad();
    assert.equal(currentURL(), `/cards/${baseCardPath}`);

    assert.dom('[data-test-field]').doesNotExist(); // base-card currenty has no fields
    await percySnapshot(assert);
  });
});
