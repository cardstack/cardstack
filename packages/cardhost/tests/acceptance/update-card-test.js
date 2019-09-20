import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import JSONAPIFactory from '@cardstack/test-support/jsonapi-factory';
import Fixtures from '@cardstack/test-support/fixtures'
import { setCodeMirrorValue, getCodeMirrorValue } from '../helpers/code-mirror';
import { createCard } from '../helpers/card-helpers';

let factory = new JSONAPIFactory();
let articleCard = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::article-card::millenial-puppies')
    .withRelated('fields', [
      factory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::article-card::millenial-puppies', 'local-hub::article-card::millenial-puppies')
      .withAttributes({
        body: 'It can be difficult these days to deal with the discerning tastes of the millenial puppy.'
      })
    )
);

const scenario = new Fixtures({
  destroy() {
    return [{ type: 'cards', id: 'local-hub::article-card::millenial-puppies' }];
  }
});

// TODO eventually these tests should manipulate a card using UI controls instead of code mirror
module('Acceptance | updating a card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test(`updating a card's internal model`, async function(assert) {
    await createCard(articleCard);
    await visit('/cards/local-hub::article-card::millenial-puppies');

    assert.equal(currentURL(), '/cards/local-hub::article-card::millenial-puppies');

    let cardStr = getCodeMirrorValue();
    let card = JSON.parse(cardStr);
    let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
    internalModel.attributes.body = 'updated body';
    setCodeMirrorValue(JSON.stringify(card, null, 2));

    await click('[data-test-card-updator-update-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');
    assert.equal(currentURL(), '/cards/local-hub::article-card::millenial-puppies');

    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-value]').hasText(`updated body`);
    card = JSON.parse(getCodeMirrorValue());
    assert.equal(card.data.attributes.body, `updated body`);
  });

  test(`adding a new field to a card`, async function(assert) {
    await createCard(articleCard);
    await visit('/cards/local-hub::article-card::millenial-puppies');

    let cardStr = getCodeMirrorValue();
    let card = JSON.parse(cardStr);
    card.data.relationships.fields.data.push({ type: 'fields', id: 'title' });
    card.included.push({
      type: 'fields',
      id: 'title',
      attributes: {
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      }
    });
    setCodeMirrorValue(JSON.stringify(card, null, 2));

    await click('[data-test-card-updator-update-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-value]').hasText('')
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-embedded]').hasText('true');
  });

  test(`deleting a field from a card`, async function(assert) {
    await createCard(articleCard);
    await visit('/cards/local-hub::article-card::millenial-puppies');

    let cardStr = getCodeMirrorValue();
    let card = JSON.parse(cardStr);
    card.data.relationships.fields.data = card.data.relationships.fields.data.filter(i => i.id !== 'body');
    card.included = card.included.filter(i => i.id !== 'body');
    setCodeMirrorValue(JSON.stringify(card, null, 2));

    await click('[data-test-card-updator-update-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-inspector-field="body"]').doesNotExist();
    card = JSON.parse(getCodeMirrorValue());
    assert.equal(card.data.attributes.body, undefined);
  });

  test(`updating a card's schema and it's internal model`, async function(assert) {
    await createCard(articleCard);
    await visit('/cards/local-hub::article-card::millenial-puppies');

    let cardStr = getCodeMirrorValue();
    let card = JSON.parse(cardStr);
    let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
    internalModel.attributes.title = 'Millenial Puppies';
    card.data.relationships.fields.data.push({ type: 'fields', id: 'title' });
    card.included.push({
      type: 'fields',
      id: 'title',
      attributes: {
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      }
    });
    setCodeMirrorValue(JSON.stringify(card, null, 2));

    await click('[data-test-card-updator-update-btn]');
    await waitFor('[data-test-card-updator-is-dirty="false"]');

    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-value]').hasText('Millenial Puppies')
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-embedded]').hasText('true');

    card = JSON.parse(getCodeMirrorValue());
    assert.equal(card.data.attributes.title, `Millenial Puppies`);
  });
});