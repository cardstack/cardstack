import { module, test, skip } from 'qunit';
import { find, visit, currentURL, click, fillIn } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForTestsToEnd, saveCard } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { percySnapshot } from 'ember-percy';
import { cardDocument } from '@cardstack/hub';

const csRealm = `http://localhost:3000/api/realms/default`;
const participantTemplate = cardDocument()
  .withAutoAttributes({
    csRealm,
    csId: 'participant-template',
    csFieldSets: {
      embedded: ['title', 'role', 'email'],
      isolated: ['title', 'role', 'email'],
    },
  })
  .withField('title', 'string-field', 'singular', { csTitle: 'Title' })
  .withField('role', 'string-field', 'singular', { csTitle: 'Role' })
  .withField('email', 'string-field', 'singular', { csTitle: 'Email' });
const artist = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'artist',
    csTitle: 'Participant',
    title: 'Pia Midina',
    role: 'Recording artist & lyricist',
    email: 'pia.midina@gmail.com',
  })
  .adoptingFrom(participantTemplate);
const composer = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'composer',
    csTitle: 'Participant',
    title: 'Miles Ponia',
    role: 'Composer',
    email: 'miles@gmail.com',
  })
  .adoptingFrom(participantTemplate);
const producer = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'producer',
    csTitle: 'Participant',
    title: 'Francesco Midina',
    role: 'Producer',
    email: 'francesco@gmail.com',
  })
  .adoptingFrom(participantTemplate);
const musicalWorkTemplate = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'musical-work-template',
  csTitle: 'Musical Work',
  csFieldSets: {
    embedded: ['title', 'description'],
    isolated: ['title', 'description'],
  },
});
const work = cardDocument()
  .withAutoAttributes({
    csRealm,
    csId: 'work',
    csTitle: 'Musical Work',
    title: 'The Leaves Are Changing Color',
    description: 'by Pia Midina, Miles Ponia',
  })
  .adoptingFrom(musicalWorkTemplate);
const recording = cardDocument().withAutoAttributes({
  csRealm,
  csId: 'recording',
  csTitle: 'Master Recording',
  csFieldSets: {
    embedded: ['title'],
    isolated: ['title', 'artists', 'musicalWork'],
  },
  csFields: {
    artists: {
      attributes: {
        csFieldArity: 'plural',
        csFields: {
          key: {
            attributes: {
              csFieldArity: 'singular',
              csFields: {},
            },
            relationships: {
              csAdoptsFrom: {
                data: {
                  id: 'https://base.cardstack.com/public/cards/string-field',
                  type: 'cards',
                },
              },
            },
          },
        },
        key: 'participant-template',
        csTitle: 'Artists',
      },
      relationships: {
        csAdoptsFrom: {
          data: {
            id: 'https://base.cardstack.com/public/cards/base',
            type: 'cards',
          },
        },
      },
    },
    musicalWork: {
      attributes: {
        csFieldArity: 'singular',
        csFields: {
          key: {
            attributes: {
              csFieldArity: 'singular',
              csFields: {},
            },
            relationships: {
              csAdoptsFrom: {
                data: {
                  id: 'https://base.cardstack.com/public/cards/string-field',
                  type: 'cards',
                },
              },
            },
          },
        },
        key: 'musical-work-template',
        csTitle: 'Musical Work',
      },
      relationships: {
        csAdoptsFrom: {
          data: {
            id: 'https://base.cardstack.com/public/cards/base',
            type: 'cards',
          },
        },
      },
    },
  },
  title: 'The Leaves Are Changing Color',
});
const cardPath = encodeURIComponent(recording.canonicalURL);
const scenario = new Fixtures({
  create: [participantTemplate, musicalWorkTemplate, artist, composer, producer, work, recording],
  destroy: [participantTemplate, musicalWorkTemplate, artist, composer, producer, work, recording],
});

module('Acceptance | card selector', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`can set base-card as reference`, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit`);

    assert.dom('[data-test-card-select]').doesNotExist();
    assert.dom(`[data-test-edit-field="musicalWork"]`).exists();
    assert.dom(`[data-test-edit-field="musicalWork"] [data-test-card-renderer-embedded]`).doesNotExist();

    await click('[data-test-embedded-card-add-btn]');
    assert.dom('[data-test-card-select]').exists();
    assert.dom('[data-test-before-options]').exists();
    assert.dom('[data-test-before-options-data-source]').hasText('Searching for Musical Work within library');

    await fillIn('[data-test-card-select] input', 'leaves');
    await waitForCardLoad(work.canonicalURL);

    assert.dom('.ember-power-select-option').exists({ count: 1 }, 'can search within cards');
    assert.dom(`[data-test-embedded-card="${work.canonicalURL}"]`).exists();

    await click(`[data-test-embedded-card="${work.canonicalURL}"]`);
    assert
      .dom(`[data-test-edit-field="musicalWork"] [data-test-card-renderer-embedded]`)
      .exists({ count: 1 }, 'can add card using card selector');
    assert
      .dom(`[data-test-edit-field="musicalWork"] [data-test-card-renderer-embedded="${work.canonicalURL}"]`)
      .exists();

    assert
      .dom('[data-test-embedded-card-add-btn]')
      .doesNotExist('add button does not exist for belongs-to field if card is selected');
    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad(work.canonicalURL);
    assert.dom('[data-test-field="musicalWork"] [data-test-card-renderer-embedded]').exists({ count: 1 });

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.musicalWork.data, { type: 'cards', id: work.canonicalURL });
  });

  test(`can set base-cards as reference with plural arity `, async function(assert) {
    await visit(`/cards/${cardPath}/edit`);
    await waitForCardLoad();

    assert.equal(currentURL(), `/cards/${cardPath}/edit`);

    assert.dom('[data-test-card-select]').doesNotExist();
    assert.dom(`[data-test-edit-field="artists"]`).exists();
    assert.dom(`[data-test-edit-field="artists"] [data-test-card-renderer-embedded]`).doesNotExist();

    await click('[data-test-has-many-add-btn]');
    assert.dom('[data-test-card-select]').exists();
    assert.dom('[data-test-before-options]').exists();
    assert.dom('[data-test-before-options-data-source]').hasText('Searching for Artists within library');

    await fillIn('[data-test-card-select] input', 'mi');
    await waitForCardLoad(artist.canonicalURL);

    assert.dom('.ember-power-select-option').exists({ count: 3 }, 'can search within participant cards');

    await fillIn('[data-test-card-select] input', 'midina');
    assert.dom('.ember-power-select-option').exists({ count: 2 }, 'can filter search results');
    assert.dom(`[data-test-embedded-card="${artist.canonicalURL}"]`).exists();

    await percySnapshot(assert);

    await click(`[data-test-embedded-card="${artist.canonicalURL}"]`);
    assert
      .dom(`[data-test-edit-field="artists"] [data-test-card-renderer-embedded]`)
      .exists({ count: 1 }, 'can add card using card selector');
    assert.dom(`[data-test-edit-field="artists"] [data-test-card-renderer-embedded="${artist.canonicalURL}"]`).exists();

    await click('[data-test-has-many-add-btn]');
    await fillIn('[data-test-card-select] input', 'ponia');
    await waitForCardLoad(composer.canonicalURL);

    assert.dom('.ember-power-select-option').exists({ count: 1 });
    await click(`[data-test-card-renderer-embedded="${composer.canonicalURL}"]`);
    assert
      .dom(`[data-test-edit-field="artists"] [data-test-card-renderer-embedded]`)
      .exists({ count: 2 }, 'can add multiple cards using card selector');
    assert
      .dom(`[data-test-edit-field="artists"] [data-test-card-renderer-embedded="${composer.canonicalURL}"]`)
      .exists();

    await saveCard();

    await visit(`/cards/${cardPath}`);
    await waitForCardLoad(artist.canonicalURL);
    await waitForCardLoad(composer.canonicalURL);
    assert.dom('[data-test-field="artists"] [data-test-card-renderer-embedded]').exists({ count: 2 });

    await percySnapshot(assert);

    let cardJson = find('[data-test-card-json]').innerHTML;
    let card = JSON.parse(cardJson);
    assert.deepEqual(card.data.relationships.artists.data, [
      { type: 'cards', id: artist.canonicalURL },
      { type: 'cards', id: composer.canonicalURL },
    ]);
  });

  skip(`can remove base-card as reference`, async function() {});
  skip(`can remove base-card as reference with plural arity field`, async function() {});
});
