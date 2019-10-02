import { module, test, skip } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setupTest } from 'ember-qunit';
import {
  updateCard,
  cleanupDefaulValueArtifacts
} from '../../helpers/card-helpers';

const card1Id = 'local-hub::article-card::millenial-puppies';
const card2Id = 'local-hub::user-card::van-gogh';
const card3Id = 'local-hub::user-card::hassan';

const titleField = {
  type: 'fields',
  id: 'title',
  attributes: {
    'is-metadata': true,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::string'
  },
};
const bodyField = {
  type: 'fields',
  id: 'body',
  attributes: {
    'is-metadata': true,
    'needed-when-embedded': false,
    'field-type': '@cardstack/core-types::string'
  },
};
const nameField = {
  type: 'fields',
  id: 'name',
  attributes: {
    'is-metadata': true,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::string'
  },
};
const authorField = {
  type: 'fields',
  id: 'author',
  attributes: {
    'is-metadata': true,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::belongs-to'
  },
};
const reviewersField = {
  type: 'fields',
  id: 'reviewers',
  attributes: {
    'is-metadata': true,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::has-many'
  },
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
        body: 'test body',
        'metadata-field-types': {
          author: "@cardstack/core-types::belongs-to",
          body: "@cardstack/core-types::string",
          title: "@cardstack/core-types::string"
        },
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
      titleField,
      bodyField,
      authorField,
      {
        type: 'cards',
        id: card2Id,
        attributes: {
          name: 'Van Gogh',
          'metadata-field-types': {
            name: "@cardstack/core-types::string",
          },
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
        'metadata-field-types': {
          author: "@cardstack/core-types::belongs-to",
          title: "@cardstack/core-types::string"
        },
      },
      relationships: {
        fields: {
          data: [
            { type: 'fields', id: 'title' },
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
          name: 'Van Gogh',
          'metadata-field-types': {
            name: "@cardstack/core-types::string",
          },
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
      card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
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
          titleField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it throws an error when you try to add a new field with missing name", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.addField({ type: '@cardstack/core-types::string' }), `missing 'name'`);
    });

    test("it throws an error when you try to add a new field with missing type", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.addField({ name: 'title' }), `missing 'type'`);
    });

    test("it throws an error when you try to add a new field that has a duplicate type and id of an existing field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField({ name: 'title', type: '@cardstack/core-types::string' });
      assert.throws(() => card.addField({ name: 'title', type: '@cardstack/core-types::string' }), `field 'fields/title' which already exists for this card`);
    });

    test("it can set an attribute field value on an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      field.setValue('Millenial Puppies');
      assert.equal(field.value, 'Millenial Puppies');
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
            type: card1Id, id: card1Id,
            attributes: {
              title: 'Millenial Puppies'
            },
          },
          titleField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a belongs-to relationship field on an isolated card by card id", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      field.setValue(card2Id);
      assert.equal(field.value.constructor.name, 'Card');
      assert.equal(field.value.id, card2Id);
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
            type: card1Id, id: card1Id,
            relationships: {
              author: {
                data: { type: 'cards', id: card2Id }
              }
            }
          },
          authorField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a belongs-to relationship field on an isolated card by card instance", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      field.setValue(person);
      assert.equal(field.value, person);
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
            type: card1Id, id: card1Id,
            relationships: {
              author: {
                data: { type: 'cards', id: card2Id }
              }
            }
          },
          authorField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a has-many relationship field on an isolated card by card id's", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      field.setValue([card2Id]);
      assert.equal(field.value[0].constructor.name, 'Card');
      assert.equal(field.value[0].id, card2Id);
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
            type: card1Id, id: card1Id,
            relationships: {
              reviewers: {
                data: [{ type: 'cards', id: card2Id }]
              }
            }
          },
          reviewersField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a has-many relationship field on an isolated card by card instances", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      field.setValue([person]);
      assert.deepEqual(field.value, [person]);
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
            type: card1Id, id: card1Id,
            relationships: {
              reviewers: {
                data: [{ type: 'cards', id: card2Id }]
              }
            }
          },
          reviewersField
        ]
      }, 'the card JSON is correct for adding a string field');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it throws an error if you try to set a has-many relationship with a non-array value", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      assert.throws(() => field.setValue(card2Id), `value must be an array of Cards`);
    });

    test("it can remove an attribute type field from an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'title', type: '@cardstack/core-types::string' });
      field.setValue('Millenial Puppies');
      assert.equal(field.isDestroyed, false, 'the field destroyed state is correct');
      field.remove();

      assert.equal(field.isDestroyed, true, 'the field destroyed state is correct');
      assert.notOk(card.fields.find(i => i.name === 'title'));
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
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
    });

    test("it can remove a relationship type field from an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      field.setValue(person);
      field.remove();

      assert.equal(field.isDestroyed, true, 'the field destroyed state is correct');
      assert.notOk(card.fields.find(i => i.name === 'author'));
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
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
    });

    test("it can save a new card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let name = person.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let email = person.addField({ name: 'email', type: '@cardstack/core-types::string' });
      name.setValue('Van Gogh');
      email.setValue('email', 'vangogh@nowhere.dog');
      await person.save();

      let article = service.createCard(card1Id);
      let title = article.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let body = article.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let author = article.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      title.setValue('test title');
      body.setValue('test body');
      author.setValue(person);
      await article.save();

      let field = article.getField('author');
      assert.equal(field.value.constructor.name, 'Card');
      assert.equal(field.value.id, person.id);
      assert.equal(article.getField('title').value, 'test title');
      assert.equal(article.getField('body').value, 'test body');

      assertCardIsIsolated(assert, article);
      assert.equal(article.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(article.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(article.isLoaded, true, 'the loaded state is correct for a saved card');
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
      let person = service.createCard(card2Id);
      let name = person.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let email = person.addField({ name: 'email', type: '@cardstack/core-types::string' });
      name.setValue('Van Gogh');
      email.setValue('email', 'vangogh@nowhere.dog');
      await person.save();

      let article = service.createCard(card1Id);
      let title = article.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let body = article.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let author = article.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      title.setValue('test title');
      body.setValue('test body');
      author.setValue(person);
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

    test("it can load field values of included embedded cards synchronously", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      let field = card.getField('author');
      assert.equal(field.value.getField('name').value, 'Van Gogh');
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

    test("it can load a cached embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      await service.getCard(card1Id, 'isolated'); // the act of getting this card caches the embedded resources

      let card = await service.getCard(card2Id, 'embedded');
      assert.equal(card.id, card2Id, 'the card id is correct');
      assert.equal(card.format, 'embedded', 'the card format is correct');
      assert.equal(card.isLoaded, true, 'the card loaded state is correct');
      assert.equal(card.isNew, false, 'the card new state is correct');
      assert.equal(card.isDirty, false, 'the card dirty state is correct');
      assert.equal(card.getField('name').value, 'Van Gogh', 'the embedded card value is correct');
      assert.equal(card.getField('email'), undefined, 'the embedded card value is correct');
    });

    test("it can get the value of an attribute-type field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').value, 'test title');
    });

    test("it can get the value of a belongs-to field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let authorCard = card.getField('author').value;

      assert.equal(authorCard.constructor.name, 'Card', 'the card instance is the correct class');
      assert.equal(authorCard.id, card2Id, 'the card id is correct');
      assert.equal(authorCard.format, 'embedded', 'the card format is correct');
      assert.equal(authorCard.isLoaded, true, 'the card loaded state is correct');
      assert.equal(authorCard.isNew, false, 'the card new state is correct');
      assert.equal(authorCard.isDirty, false, 'the card dirty state is correct');
    });

    test("it can get the value of a has-many field", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let reviewers = card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      reviewers.setValue([card2Id]);
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      let cards = card.getField('reviewers').value;
      assert.equal(cards.length, 1, 'the number of related cards is correct');
      let [reviewerCard] = cards;
      assert.equal(reviewerCard.constructor.name, 'Card', 'the card instance is the correct class');
      assert.equal(reviewerCard.id, card2Id, 'the card id is correct');
      assert.equal(reviewerCard.format, 'embedded', 'the card format is correct');
      assert.equal(reviewerCard.isLoaded, true, 'the card loaded state is correct');
      assert.equal(reviewerCard.isNew, false, 'the card new state is correct');
      assert.equal(reviewerCard.isDirty, false, 'the card dirty state is correct');
    });

    test("it can get the value of an empty has-many relationship", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      assert.deepEqual(card.getField('reviewers').value, [], 'the empty has-many field value is correct');
    });

    test("it returns undefined when you try to get a field that is only available in the isolated format when the card is embedded", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.getField('body'), undefined, 'the embedded card value is correct');
    });

    test("it can get a field's type", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').type, '@cardstack/core-types::string', 'the field type is correct');
    });

    test("it can get a field's neededWhenEmbedded value", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').neededWhenEmbedded, true, 'the neededWhenEmbedded value is correct');
      assert.equal(card.getField('body').neededWhenEmbedded, false, 'the neededWhenEmbedded value is correct');
    });

    test("it returns undefined when you try to get a field type that is only available in the isolated format when the card is embedded", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.getField('body'), undefined, 'the field does not exist when the card is in the embedded format');
    });

    test("it updates the field availability when an embedded card loads in isolated format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');
      assert.equal(card.getField('body').value, 'test body', 'the field value is correct');
    });

    test("it updates the field availability when an isolated card loads in an embedded format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('embedded');
      assert.equal(card.getField('body'), undefined, 'the field value is correct');
    });

    test("it returns undefined when you get a field that doesn't exist", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('foo'), undefined);
    });

    test("it can return all the fields for an isolated card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.deepEqual(card.fields.map(i => i.name), ['title', 'body', 'author'], 'the fields are correct');
    });

    test("it can return all the fields for an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.deepEqual(card.fields.map(i => i.name), ['title', 'author'], 'the fields are correct');
    });
  });

  module("update card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');

      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let name = person.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let email = person.addField({ name: 'email', type: '@cardstack/core-types::string' });
      name.setValue('Van Gogh');
      email.setValue('email', 'vangogh@nowhere.dog');
      await person.save();

      let article = service.createCard(card1Id);
      let title = article.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let body = article.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let author = article.addField({ name: 'author', type: '@cardstack/core-types::belongs-to', neededWhenEmbedded: true });
      title.setValue('test title');
      body.setValue('test body');
      author.setValue(person);
      await article.save();

      service._clearCache();
    });

    test("it can add a new field to an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.deepEqual(cardDoc.data.relationships.fields.data,
        [
          { type: 'fields', id: 'title' },
          { type: 'fields', id: 'body' },
          { type: 'fields', id: 'author' },
          { type: 'fields', id: 'name' },
        ]
      );
      assert.deepEqual(cardDoc.included.pop(), nameField);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can remove a field from an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let title = card.getField('title');
      title.remove();

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
      assert.equal(title.isDestroyed, true, 'the destroyed state is correct for removed field');
    });

    test("it can set a attribute type field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.getField('title').setValue('updated title');

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.title, 'updated title');
      assert.equal(cardDoc.data.attributes.title, 'test title'); // card metadata is not updated until after the card is saved
    });

    test("it can set a belongs-to relationship field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.getField('author').setValue(service.createCard(card3Id));

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.deepEqual(model.relationships.author.data, { type: 'cards', id: card3Id });
      assert.deepEqual(cardDoc.data.relationships.author.data, { type: 'cards', id: card2Id }); // card metadata is not updated until after the card is saved
    });

    test("it can set a has-many relationship field value in an existing card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let reviewers = card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      reviewers.setValue([await service.getCard(card2Id, 'embedded')]);
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      reviewers = card.getField('reviewers');
      reviewers.setValue(reviewers.value.concat([service.createCard(card3Id)]));

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
      card.getField('title').setValue('updated title');
      await card.save();

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.equal(card.getField('title').value, 'updated title');
      assert.equal(cardDoc.data.attributes.title, 'updated title');
    });

    skip("it can change a needed-when-embedded field to be an isolated-only field", async function (/*assert*/) {
    });

    skip("it can change an isolated-only field to be a needed-when-embedded field", async function (/*assert*/) {
    });


    test("it throws an error when a card saved in an embedded format", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await assert.rejects(card.save(), 'card is in the embedded format');
    });

    test("it throws an error if you try to set a field value on an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('title');
      assert.throws(() => field.setValue('test'), 'card is in the embedded format');
    });

    test("it throws an error if you try to add a new field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.addField({ name: 'name', type: '@cardstack/core-types::string' }), 'card is in the embedded format');
    });

    test("it throws an error if you try to add a remove a field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('title');
      assert.throws(() => field.remove(), 'card is in the embedded format');
    });

    skip("it throws an error if you try to add a move a field to an embedded card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('author');
      assert.throws(() => card.moveField(field, 0), 'card is in the embedded format');
    });
  });

  module("delete card", function (hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function () {
      await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
      let service = this.owner.lookup('service:data');

      let article = service.createCard(card1Id);
      let title = article.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let body = article.addField({ name: 'body', type: '@cardstack/core-types::string' });
      title.setValue('test title');
      body.setValue('test body');
      await article.save();
      service._clearCache();
    });


    test("it can delete a card", async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let { fields } = card;
      assert.equal(fields.every(i => !i.isDestroyed), true, 'fields destroyed state is correct');
      assert.equal(card.isDestroyed, false, 'card destroyed state is correct');
      await card.delete();

      assert.equal(card.isDestroyed, true, 'card destroyed state is correct');
      assert.equal(fields.every(i => i.isDestroyed), true, 'fields destroyed state is correct');
      await assert.rejects(service.getCard(card1Id, 'isolated'), 'Not Found:');
    });

    test('throws when you call addField from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.addField(nameField), 'destroyed card');
    });

    test('throws when you call fields from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.fields, 'destroyed card');
    });

    test('throws when you call format from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.format, 'destroyed card');
    });

    test('throws when you call isNew from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.isNew, 'destroyed card');
    });

    test('throws when you call isDirty from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.isDirty, 'destroyed card');
    });

    test('throws when you call isLoaded from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.isLoaded, 'destroyed card');
    });

    test('throws when you call getField from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.getField('title'), 'destroyed card');
    });

    skip('throws when you call moveField from deleted Card instance', async function (/*assert*/) {
    });

    test('throws when you call save from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.save(), 'destroyed card');
    });

    test('throws when you call load from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.load('embedded'), 'destroyed card');
    });

    test('throws when you call delete from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.delete(), 'destroyed card');
    });

    test('throws when you get json from deleted Card instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.json, 'destroyed card');
    });

    test('throws when you get the card from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.card, 'destroyed field');
    });

    test('throws when you get the name from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.name, 'destroyed field');
    });

    test('throws when you get the neededWhenEmbedded value from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.neededWhenEmbedded, 'destroyed field');
    });

    test('throws when you get the value from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.value, 'destroyed field');
    });

    test('throws when you get the json from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.json, 'destroyed field');
    });

    test('throws when you set the value from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setValue('update'), 'destroyed field');
    });

    test('throws when you call remove from deleted Field instance', async function (assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.remove(), 'destroyed field');
    });

    skip('throws when you call setNeededWhenEmbedded from deleted Field instance', async function (/*assert*/) {
    });
  });
});
