import { module, test, skip } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setupTest } from 'ember-qunit';
import { cloneDeep } from 'lodash';
import { cleanupDefaulValueArtifacts } from '../../helpers/card-helpers';

const card1Id = 'local-hub::article-card::millenial-puppies';
const card2Id = 'local-hub::user-card::van-gogh';

const titleField = {
  data: {
    type: 'fields',
    id: 'title',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': true,
      'field-type': '@cardstack/core-types::string'
    },
    relationships: {}
  }
};
const authorField = {
  data: {
    type: 'fields',
    id: 'author',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': true,
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {}
  }
};
const reviewersField = {
  data: {
    type: 'fields',
    id: 'reviewers',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': true,
      'field-type': '@cardstack/core-types::has-many'
    },
    relationships: {}
  }
};

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').
      withAttributes({
        sourceType: '@cardstack/mock-auth',
        mayCreateUser: true,
        params: {
          users: {
            'sample-user': { verified: true }
          }
        }
      });
    factory.addResource('grants')
      .withAttributes({
        mayWriteFields: true,
        mayReadFields: true,
        mayCreateResource: true,
        mayReadResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayLogin: true
      })
      .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
  },

  destroy() {
    return [
      { type: 'cards', id: card1Id },
      { type: 'cards', id: card2Id }
    ];
  }
});

module("Unit | Service | data", function(hooks) {
  setupTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function () {
    await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
  });

  test("it creates new card instance", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    assert.equal(card.id, card1Id, 'the card ID is correct')
    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        { type: card1Id, id: card1Id }
      ]
    }, 'the card JSON is correct for a new card');
    assert.equal(card.format, 'isolated', 'the card format is correct for new card');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
    assert.equal(card.isLoaded, false, 'the loaded state is correct for a new card');
    assert.equal(card.isNew, true, 'the isNew state is correct for a new card');
  });

  test("it can add a new field to an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(titleField);
    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [ { type: 'fields', id: 'title' } ],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        { type: card1Id, id: card1Id },
        titleField.data
      ]
    }, 'the card JSON is correct for adding a string field');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
  });

  skip("it throws an error if you try to add a new field to an embedded card", async function(/*assert*/) {
    // TODO use service.getCard(xxx, 'embedded') to test this...
  });

  test("it throws an error when you try to add a new field with invalid JSON:API doc -- missing 'data' property", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    assert.throws(() => card.addField({
      type: 'fields',
      id: 'title',
      attributes: {
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      },
    }), `missing 'data' property`);
  });

  test("it throws an error when you try to add a new field with missing document 'id'", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    let badField = cloneDeep(titleField);
    delete badField.data.id;
    assert.throws(() => card.addField(badField), `missing 'id' property`);
  });

  test("it throws an error when you try to add a new field with missing 'field-type' attribute", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    let badField = cloneDeep(titleField);
    delete badField.data.attributes['field-type'];
    assert.throws(() => card.addField(badField), `missing a 'field-type' property`);
  });

  test("it throws an error when you try to add a new field with a non-'fields' document type", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    let badField = cloneDeep(titleField);
    badField.data.type = 'cards';
    assert.throws(() => card.addField(badField), `does not have a 'type' of 'fields'`);
  });

  test("it throws an error when you try to add a new field that has a duplicate type and id of an existing field", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(titleField);
    assert.throws(() => card.addField(titleField), `field 'fields/title' which already exists for this card`);
  });

  test("it can set an attribute field value on an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(titleField);
    card.setField('title', 'Millenial Puppies');
    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [ { type: 'fields', id: 'title' } ],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        {
          type: card1Id,
          id: card1Id,
          attributes: {
            title: 'Millenial Puppies'
          }
        },
        titleField.data
      ]
    }, 'the card JSON is correct for adding a string field');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
  });

  test("it can set a belongs-to relationship field on an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(authorField);
    card.setField('author', card2Id);
    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [ { type: 'fields', id: 'author' } ],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        {
          type: card1Id,
          id: card1Id,
          relationships: {
            author: {
              data: { type: 'cards', id: card2Id }
            }
          }
        },
        authorField.data
      ]
    }, 'the card JSON is correct for adding a string field');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
  });

  test("it can set a has-many relationship field on an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(reviewersField);
    card.setField('reviewers', [card2Id]);
    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [ { type: 'fields', id: 'reviewers' } ],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        {
          type: card1Id,
          id: card1Id,
          relationships: {
            reviewers: {
              data: [{ type: 'cards', id: card2Id }]
            }
          }
        },
        reviewersField.data
      ]
    }, 'the card JSON is correct for adding a string field');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
  });

  test("it throws an error if you try to set a field that doesn't exist on the card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    assert.throws(() => card.setField('does-not-exist', 'foo'), `non-existent field 'fields/does-not-exist'`);
  });

  test("it throws an error if you try to set a has-many relationship with a non-array value", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(reviewersField);
    assert.throws(() => card.setField('reviewers', card2Id), `value must be an array of card ID's`);
  });

  skip("it throws an error if you try to set a field on an embedded card", async function(/*assert*/) {
    // TODO use service.getCard(xxx, 'embedded') to test this...
  });

  test("it can remove an attribute type field from an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(titleField);
    card.setField('title', 'Millenial Puppies');
    card.removeField('title');

    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        { type: card1Id, id: card1Id, attributes: {} }
      ]
    }, 'the card JSON is correct for a new card');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
  });

  test("it can remove a relationship type field from an isolated card", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(authorField);
    card.setField('author', card2Id);
    card.removeField('author');

    assert.deepEqual(JSON.parse(card.json), {
      data: {
        id: card1Id,
        type: 'cards',
        relationships: {
          fields: {
            data: [],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        { type: card1Id, id: card1Id, relationships: {} }
      ]
    }, 'the card JSON is correct for a new card');
    assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
  });

  test("it throws as error is you try to remove a field that does not exist", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    assert.throws(() => card.removeField('author'), `non-existent field 'fields/author'`);
  });

  skip("it throws as error is you try to remove a field on an embedded card", async function(/*assert*/) {
    // TODO use service.getCard(xxx, 'embedded') to test this...
  });

  test('it can save a new card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField(titleField);
    card.setField('title', 'Millenial Puppies');
    await card.save();

    let cardDoc = cleanupDefaulValueArtifacts(JSON.parse(card.json));
    assert.ok(cardDoc.data.meta.version);
    delete cardDoc.data.meta;

    assert.deepEqual(cardDoc, {
      data: {
        id: card1Id,
        type: 'cards',
        attributes: {
          title: 'Millenial Puppies'
        },
        relationships: {
          fields: {
            data: [ { type: 'fields', id: 'title' } ],
          },
          model: {
            data: { type: card1Id, id: card1Id }
          }
        }
      },
      included: [
        {
          type: card1Id,
          id: card1Id,
          attributes: {
            title: 'Millenial Puppies'
          },
          relationships: {}
        },
        titleField.data
      ]
    }, 'the card JSON is correct');

    assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
    assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
    assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
  });
});
