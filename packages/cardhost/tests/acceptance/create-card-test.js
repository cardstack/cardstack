import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { getCodeMirrorValue, setCodeMirrorValue } from '../helpers/code-mirror';
import JSONAPIFactory from '@cardstack/test-support/jsonapi-factory';
import { createCard } from '../helpers/card-helpers';

const scenario = new Fixtures({
  destroy() {
    return [
      { type: 'cards', id: 'local-hub::article-card::millenial-puppies' },
      { type: 'cards', id: 'local-hub::user-card::van-gogh' }
    ];
  }
});

module('Acceptance | create card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('creating a card', async function(assert) {
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await click('[data-test-card-creator-add-btn]');
    await waitFor('[data-test-card-updator="local-hub::article-card::millenial-puppies"]');

    assert.equal(currentURL(), '/cards/local-hub::article-card::millenial-puppies');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-value]').hasText('The Millenial Puppy');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-embedded]').hasText('true');

    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-value]').hasText('Van Gogh');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-embedded]').hasText('true');

    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-value]').hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-embedded]').hasText('false');

    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-value]').hasText(`this is internal data`);
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-is-meta]').hasText('false');
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-embedded]').hasText('false');

    let card = JSON.parse(getCodeMirrorValue());
    assert.equal(card.data.attributes.title, 'The Millenial Puppy');
    assert.equal(card.data.attributes.author, 'Van Gogh');
    assert.equal(card.data.attributes.body, `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.equal(card.data.attributes['internal-field'], undefined);
  });

  test('cannot create card with invalid model', async function(assert) {
    let factory = new JSONAPIFactory();
    let card = factory.getDocumentFor(
      factory.addResource('cards', 'local-hub::foreign-model-id-card::bad')
        .withRelated('fields', [
          factory.addResource('fields', 'local-hub::foreign-model-id-card::bad::title').withAttributes({
            'is-metadata': true,
            'field-type': '@cardstack/core-types::string'
          }),
        ])
        .withRelated('model', factory.addResource('local-hub::foreign-model-id-card::bad', 'local-hub::foreign-model-id-card::ugh')
          .withAttributes({
            'title': "I don't belong to you"
          })
        )
    );

    await visit('/cards/new');
    setCodeMirrorValue(JSON.stringify(card, null, 2));

    await click('[data-test-card-creator-add-btn]');
    await waitFor('[data-test-card-creator-msg]');

    assert.equal(currentURL(), '/cards/new');
    assert.dom('[data-test-card-creator-msg]').includesText('the card model does not match the card id');
  });

  test('can create a card that has a relationship to another card', async function(assert) {
    let factory = new JSONAPIFactory();

    await createCard(factory.getDocumentFor(
      factory.addResource('cards', 'local-hub::user-card::van-gogh')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            'is-metadata': true,
            'needed-when-embedded': true,
            'field-type': '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'email').withAttributes({
            'is-metadata': true,
            'field-type': '@cardstack/core-types::case-insensitive'
          }),
        ])
        .withRelated('model', factory.addResource('local-hub::user-card::van-gogh', 'local-hub::user-card::van-gogh')
          .withAttributes({
            name: 'Van Gogh',
            email: 'vangogh@nowhere.dog'
          })
        )
    ));

    factory = new JSONAPIFactory();
    await createCard(factory.getDocumentFor(
      factory.addResource('cards', 'local-hub::article-card::millenial-puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'body').withAttributes({
            'is-metadata': true,
            'field-type': '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'author').withAttributes({
            'is-metadata': true,
            'needed-when-embedded': true,
            'field-type': '@cardstack/core-types::belongs-to'
          }),
        ])
        .withRelated('model', factory.addResource('local-hub::article-card::millenial-puppies', 'local-hub::article-card::millenial-puppies')
          .withAttributes({
            body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.'
          })
          .withRelated('author', { type: 'cards', id: 'local-hub::user-card::van-gogh'})
        )
    ));

    assert.equal(currentURL(), '/cards/local-hub::article-card::millenial-puppies');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-value]').hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-embedded]').hasText('false');

    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-value]').includesText('{ "type": "cards", "id": "local-hub::user-card::van-gogh" }');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::belongs-to');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-embedded]').hasText('true');

    let card = JSON.parse(getCodeMirrorValue());
    assert.deepEqual(card.data.relationships.author.data, { type: 'cards', id: 'local-hub::user-card::van-gogh' });
    let userCard = card.included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
    assert.equal(userCard.attributes.name, 'Van Gogh');
    assert.equal(userCard.attributes.email, undefined);
  });
});
