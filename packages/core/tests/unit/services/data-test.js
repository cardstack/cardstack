import { module, test, skip } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setupTest } from 'ember-qunit';
import { cloneDeep } from 'lodash';
import {
  updateCard,
  cleanupDefaulValueArtifacts
} from '../../helpers/card-helpers';

const card1Id = 'local-hub::article-card::millenial-puppies';
const card2Id = 'local-hub::user-card::van-gogh';
const card3Id = 'local-hub::user-card::hassan';

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
const internalField = {
  data: {
    type: 'fields',
    id: 'internal-field',
    attributes: {
      'is-metadata': false,
      'needed-when-embedded': false,
      'field-type': '@cardstack/core-types::string'
    },
    relationships: {}
  }
};
const bodyField = {
  data: {
    type: 'fields',
    id: 'body',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': false,
      'field-type': '@cardstack/core-types::string'
    },
    relationships: {}
  }
};
const nameField = {
  data: {
    type: 'fields',
    id: 'name',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': true,
      'field-type': '@cardstack/core-types::string'
    },
    relationships: {}
  }
};
const emailField = {
  data: {
    type: 'fields',
    id: 'email',
    attributes: {
      'is-metadata': true,
      'needed-when-embedded': false,
      'field-type': '@cardstack/core-types::case-insensitive'
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

function assertCardIsIsolated(assert, card) {
  assert.equal(card.format, 'isolated', 'the card format is correct');

  let cardDoc = cleanupDefaulValueArtifacts(card.json);
  assert.ok(cardDoc.data.meta.version);
  delete cardDoc.data.meta;

  assert.deepEqual(cardDoc, {
    data: {
      id: card1Id,
      type: 'cards',
      attributes: {
        title: 'test title',
        body: 'test body'
      },
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'title' },
            { type: 'fields', id: 'body' },
            { type: 'fields', id: 'author' }
          ],
        },
        model: {
          data: { type: card1Id, id: card1Id }
        },
        author: {
          data: { type: 'cards', id: card2Id }
        }
      }
    },
    included: [
      {
        type: card1Id,
        id: card1Id,
        attributes: {
          title: 'test title',
          body: 'test body'
        },
        relationships: {
          author: {
            data: { type: 'cards', id: card2Id }
          }
        }
      },
      titleField.data,
      bodyField.data,
      authorField.data,
      {
        type: 'cards',
        id: card2Id,
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'name' },
              { type: 'fields', id: 'email' },
            ],
          },
          model: {
            data: { type: card2Id, id: card2Id }
          }
        }
      }
    ]
  }, 'the card JSON is correct');
}

function assertCardIsEmbedded(assert, card) {
  assert.equal(card.format, 'embedded', 'the card format is correct');

  let cardDoc = cleanupDefaulValueArtifacts(card.json);
  assert.ok(cardDoc.data.meta.version);
  delete cardDoc.data.meta;
  assert.deepEqual(cardDoc, {
    data: {
      id: card1Id,
      type: 'cards',
      attributes: {
        title: 'test title',
      },
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'title' },
            { type: 'fields', id: 'body' },
            { type: 'fields', id: 'author' }
          ],
        },
        model: {
          data: { type: card1Id, id: card1Id }
        },
        author: {
          data: { type: 'cards', id: card2Id }
        }
      }
    },
    included: [
      {
        type: 'cards',
        id: card2Id,
        attributes: {
          name: 'Van Gogh'
        },
        relationships: {
          fields: {
            data: [
              { type: 'fields', id: 'name' },
              { type: 'fields', id: 'email' },
            ],
          },
          model: {
            data: { type: card2Id, id: card2Id }
          }
        }
      }
    ]
  }, 'the card JSON is correct');
}

module("Unit | Service | data", function () {
  module("add card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
    });

    test("it creates new card instance", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.equal(card.id, card1Id, 'the card ID is correct')
      assert.deepEqual(card.json, {
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

    test("it can add a new field to an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(titleField);
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'title' }],
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

    test("it throws an error when you try to add a new field with invalid JSON:API doc -- missing 'data' property", async function (assert) {
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

    test("it throws an error when you try to add a new field with missing document 'id'", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let badField = cloneDeep(titleField);
      delete badField.data.id;
      assert.throws(() => card.addField(badField), `missing 'id' property`);
    });

    test("it throws an error when you try to add a new field with missing 'field-type' attribute", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let badField = cloneDeep(titleField);
      delete badField.data.attributes['field-type'];
      assert.throws(() => card.addField(badField), `missing a 'field-type' property`);
    });

    test("it throws an error when you try to add a new field with a non-'fields' document type", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let badField = cloneDeep(titleField);
      badField.data.type = 'cards';
      assert.throws(() => card.addField(badField), `does not have a 'type' of 'fields'`);
    });

    test("it throws an error when you try to add a new field that has a duplicate type and id of an existing field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(titleField);
      assert.throws(() => card.addField(titleField), `field 'fields/title' which already exists for this card`);
    });

    test("it can set an attribute field value on an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(titleField);
      card.setFieldValue('title', 'Millenial Puppies');
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'title' }],
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

    test("it can set a belongs-to relationship field on an isolated card by card id", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(authorField);
      card.setFieldValue('author', card2Id);
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'author' }],
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

    test("it can set a belongs-to relationship field on an isolated card by card instance", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      card.addField(authorField);
      card.setFieldValue('author', person);
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'author' }],
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

    test("it can set a has-many relationship field on an isolated card by card id's", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(reviewersField);
      card.setFieldValue('reviewers', [card2Id]);
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'reviewers' }],
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

    test("it can set a has-many relationship field on an isolated card by card instances", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      card.addField(reviewersField);
      card.setFieldValue('reviewers', [person]);
      assert.deepEqual(card.json, {
        data: {
          id: card1Id,
          type: 'cards',
          relationships: {
            fields: {
              data: [{ type: 'fields', id: 'reviewers' }],
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

    test("it throws an error if you try to set a field that doesn't exist on the card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.setFieldValue('does-not-exist', 'foo'), `non-existent field 'fields/does-not-exist'`);
    });

    test("it throws an error if you try to set a has-many relationship with a non-array value", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(reviewersField);
      assert.throws(() => card.setFieldValue('reviewers', card2Id), `value must be an array of card ID's`);
    });

    test("it can remove an attribute type field from an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(titleField);
      card.setFieldValue('title', 'Millenial Puppies');
      card.removeField('title');

      assert.deepEqual(card.json, {
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

    test("it can remove a relationship type field from an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField(authorField);
      card.setFieldValue('author', card2Id);
      card.removeField('author');

      assert.deepEqual(card.json, {
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

    test("it throws as error is you try to remove a field that does not exist", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.removeField('author'), `non-existent field 'fields/author'`);
    });

    test("it can save a new card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let author = service.createCard(card2Id);
      author.addField(nameField);
      author.setFieldValue('name', 'Van Gogh');
      author.addField(emailField);
      author.setFieldValue('email', 'vangogh@nowhere.dog');
      await author.save();

      let card = service.createCard(card1Id);
      card.addField(titleField);
      card.setFieldValue('title', 'test title');
      card.addField(bodyField);
      card.setFieldValue('body', 'test body');
      card.addField(authorField);
      card.setFieldValue('author', author);
      await card.save();

      assertCardIsIsolated(assert, card);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
    });

    skip("it can change the position of a field for an isolated card", async function (/*assert*/) {
    });
  });

  module("get card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');

      let service = this.owner.lookup('service:data');
      let author = service.createCard(card2Id);
      author.addField(nameField);
      author.setFieldValue('name', 'Van Gogh');
      author.addField(emailField);
      author.setFieldValue('email', 'vangogh@nowhere.dog');
      await author.save();

      let article = service.createCard(card1Id);
      article.addField(titleField);
      article.setFieldValue('title', 'test title');
      article.addField(bodyField);
      article.setFieldValue('body', 'test body');
      article.addField(authorField);
      article.setFieldValue('author', author);
      await article.save();
      service._clearCache();
    });

    test("it can get a card in the isolated format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assertCardIsIsolated(assert, card);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
    });

    test("it can get a card in the embedded format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');

      assertCardIsEmbedded(assert, card);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
    });

    test("it can load the isolated format of an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');

      assertCardIsIsolated(assert, card);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
    });

    test("it can load the embedded format of an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.load('embedded');

      assertCardIsEmbedded(assert, card);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.isLoaded, true, 'the loaded state is correct for a saved card');
    });

    test("it throws an error when you try to get a card in an unknown format", async function (assert) {
      let service = this.owner.lookup('service:data');
      await assert.rejects(service.getCard(card1Id, 'foo'), 'unknown format specified');
    });

    test("it throws an error when you try to get a card that does not exist", async function (assert) {
      let service = this.owner.lookup('service:data');
      await assert.rejects(service.getCard('local-hub::article-card::does-not-exist', 'isolated'), 'Not Found');
    });

    test("it throws an error when you try to load a card in an unknown format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await assert.rejects(card.load('foo'), 'unknown format specified');
    });

    test("load() will update card with any updated field values", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let cardDoc = card.json;
      let index = cardDoc.included.findIndex(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      cardDoc.included[index].attributes.title = 'updated title'
      await updateCard(card1Id, cardDoc);
      assert.equal(card.json.data.attributes.title, 'test title', 'the field value is correct');
      await card.load('isolated');
      assert.equal(card.json.data.attributes.title, 'updated title', 'the field value is correct');
    });

    test("it can load the embedded card after loading a card that includes the embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      await service.getCard(card1Id, 'isolated');
      let card = await service.getCard(card2Id, 'embedded');
      assert.equal(card.id, card2Id, 'the card id is correct');
      assert.equal(card.format, 'embedded', 'the card format is correct');
      assert.equal(card.isLoaded, true, 'the card loaded state is correct');
      assert.equal(card.isNew, false, 'the card new state is correct');
      assert.equal(card.isDirty, false, 'the card dirty state is correct');
      assert.equal(card.getFieldValue('name'), 'Van Gogh', 'the embedded card value is correct');
      assert.equal(card.getFieldValue('email'), undefined, 'the embedded card value is correct');
    });

    test("it can get the value of an attribute-type field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getFieldValue('title'), 'test title');
    });

    test("it can get the value of a relationship-type field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let authorCard = card.getFieldValue('author');

      assert.equal(authorCard.id, card2Id, 'the card id is correct');
      assert.equal(authorCard.format, 'embedded', 'the card format is correct');
      assert.equal(authorCard.isLoaded, true, 'the card loaded state is correct');
      assert.equal(authorCard.isNew, false, 'the card new state is correct');
      assert.equal(authorCard.isDirty, false, 'the card dirty state is correct');
      assert.equal(authorCard.getFieldValue('name'), 'Van Gogh', 'the embedded card value is correct');
      assert.equal(authorCard.getFieldValue('email'), undefined, 'the embedded card value is correct');
    });

    test("it can get the value of an empty has-many relationship", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField(reviewersField);
      card.setFieldValue('reviewers', [card2Id]);
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      let cards = card.getFieldValue('reviewers');
      assert.equal(cards.length, 1, 'the number of related cards is correct');
      let [ reviewerCard ] = cards;
      assert.equal(reviewerCard.id, card2Id, 'the card id is correct');
      assert.equal(reviewerCard.format, 'embedded', 'the card format is correct');
      assert.equal(reviewerCard.isLoaded, true, 'the card loaded state is correct');
      assert.equal(reviewerCard.isNew, false, 'the card new state is correct');
      assert.equal(reviewerCard.isDirty, false, 'the card dirty state is correct');
      assert.equal(reviewerCard.getFieldValue('name'), 'Van Gogh', 'the embedded card value is correct');
      assert.equal(reviewerCard.getFieldValue('email'), undefined, 'the embedded card value is correct');
    });

    test("it only retrieves field values from saved card data", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.setFieldValue('title', 'updated title');
      assert.equal(card.getFieldValue('title'), 'test title');
      await card.save();
      assert.equal(card.getFieldValue('title'), 'updated title');
    });

    test("it returns undefined when you try to get a field that is only available in the isolated format when the card is embedded", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.getFieldValue('body'), undefined, 'the embedded card value is correct');
    });

    test("it returns undefined when you try to get a field that is an internal card field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField(internalField);
      card.setFieldValue('internal-field', 'this is internal');
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.getFieldValue('internal-field'), undefined, 'the internal card field is not available');
    });

    skip("it can get the field type for an isolated card", async function(/*assert*/) {
    });

    skip("it can get the field type for an embedded card", async function(/*assert*/) {
    });

    skip("it returns undefined when you try to get a field type that is only available in the isolated format when the card is embedded", async function(/*assert*/) {
    });

    skip("it returns undefined when you try to get a field type for a field that does not exist", async function(/*assert*/) {
    });

    skip("it can return all the fields for an isolated card", async function (/*assert*/) {
    });

    skip("it can return all the needed-when-embedded fields for an embedded card", async function (/*assert*/) {
    });

  });

  module("update card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');

      let service = this.owner.lookup('service:data');
      let author = service.createCard(card2Id);
      author.addField(nameField);
      author.setFieldValue('name', 'Van Gogh');
      author.addField(emailField);
      author.setFieldValue('email', 'vangogh@nowhere.dog');
      await author.save();

      let article = service.createCard(card1Id);
      article.addField(titleField);
      article.setFieldValue('title', 'test title');
      article.addField(bodyField);
      article.setFieldValue('body', 'test body');
      article.addField(authorField);
      article.setFieldValue('author', author);
      await article.save();
      service._clearCache();
    });

    test("it can add a new field to an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField(nameField);

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.deepEqual(cardDoc.data.relationships.fields.data,
        [
          { type: 'fields', id: 'title' },
          { type: 'fields', id: 'body' },
          { type: 'fields', id: 'author' },
          { type: 'fields', id: 'name' },
        ]
      );
      assert.deepEqual(cardDoc.included.pop(), nameField.data);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can remove a field from an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.removeField('title');

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.deepEqual(cardDoc.data.relationships.fields.data,
        [
          { type: 'fields', id: 'body' },
          { type: 'fields', id: 'author' },
        ]
      );
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.title, undefined, 'the title model data no longer exists');
      assert.notOk(cardDoc.included.find(i => `${i.type}/${i.id}` === `fields/title`));
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a attribute type field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.setFieldValue('title', 'updated title');

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.title, 'updated title');
      assert.equal(cardDoc.data.attributes.title, 'test title'); // card metadata is not updated until after the card is saved
    });

    test("it can set a belongs-to relationship field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.setFieldValue('author', service.createCard(card3Id));

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.deepEqual(model.relationships.author.data, { type: 'cards', id: card3Id });
      assert.deepEqual(cardDoc.data.relationships.author.data, { type: 'cards', id: card2Id }); // card metadata is not updated until after the card is saved
    });

    test("it can set a has-many relationship field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField(reviewersField);
      card.setFieldValue('reviewers', [await service.getCard(card2Id, 'embedded')]);
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      let reviewers = card.getFieldValue('reviewers');
      reviewers.push(service.createCard(card3Id));
      card.setFieldValue('reviewers', reviewers);

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.deepEqual(model.relationships.reviewers.data, [
        { type: 'cards', id: card2Id },
        { type: 'cards', id: card3Id }
      ]);
      assert.deepEqual(cardDoc.data.relationships.reviewers.data, [
        { type: 'cards', id: card2Id } // card metadata is not updated until after the card is saved
      ]);
    });

    test("it can save an updated card when it is an isolated format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.setFieldValue('title', 'updated title');
      await card.save();

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.equal(cardDoc.data.attributes.title, 'updated title');
      assert.equal(card.getFieldValue('title'), 'updated title');
    });

    test("it throws an error when a card saved in an embedded format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await assert.rejects(card.save(), 'card is in the embedded format');
    });

    test("it throws an error if you try to set a field value on an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.setFieldValue('title', 'test'), 'card is in the embedded format');
    });

    test("it throws an error if you try to add a new field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.addField(nameField), 'card is in the embedded format');
    });

    test("it throws an error if you try to add a remove a field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.removeField('title'), 'card is in the embedded format');
    });

    skip("it throws an error if you try to add a move a field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.moveField('author', 0), 'card is in the embedded format');
    });
  });

  module("delete card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
      let service = this.owner.lookup('service:data');

      let article = service.createCard(card1Id);
      article.addField(titleField);
      article.setFieldValue('title', 'test title');
      article.addField(bodyField);
      article.setFieldValue('body', 'test body');
      await article.save();
      service._clearCache();
    });

    test("it can delete a card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isDestroyed, false, 'card destroyed state is correct');
      await card.delete();

      assert.equal(card.isDestroyed, true, 'card destroyed state is correct');
      await assert.rejects(service.getCard('local-hub::article-card::does-not-exist', 'isolated'), 'Not Found:');
    });

    test("it can delete a card from an unloaded Card instance", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.createCard(card1Id);
      assert.equal(card.isLoaded, false, 'card loaded state is correct');
      assert.equal(card.isDestroyed, false, 'card destroyed state is correct');
      await card.delete();

      assert.equal(card.isDestroyed, true, 'card destroyed state is correct');
      await assert.rejects(service.getCard('local-hub::article-card::does-not-exist', 'isolated'), 'Not Found:');
    });

    test('throws when you call getFieldValue from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.getFieldValue('title'), 'destroyed card');
    });

    test('throws when you call addField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.addField(nameField), 'destroyed card');
    });

    test('throws when you call removeField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.removeField('title'), 'destroyed card');
    });

    test('throws when you call setFieldValue from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.setFieldValue('title', 'foo'), 'destroyed card');
    });

    test('throws when you call getAllFields from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.getAllFields(), 'destroyed card');
    });

    test('throws when you call moveField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.moveField('body', 0), 'destroyed card');
    });

    test('throws when you call save from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.save(), 'destroyed card');
    });

    test('throws when you call load from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.load('embedded'), 'destroyed card');
    });

    test('throws when you call delete from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.delete(), 'destroyed card');
    });

    test('throws when you get json from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.json, 'destroyed card');
    });
  });
});
