import { module, test, skip } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { setupTest } from 'ember-qunit';
import { updateCard, cleanupDefaulValueArtifacts } from '../../helpers/card-helpers';

const card1Id = 'local-hub::millenial-puppies';
const card2Id = 'local-hub::van-gogh';
const card3Id = 'local-hub::hassan';
const card4Id = 'local-hub::user-card';
const card5Id = 'local-hub::mango';
const card6Id = 'local-hub::ringo';
const card7Id = 'local-hub::musa';

const titleField = {
  type: 'fields',
  id: 'title',
  attributes: {
    'is-metadata': true,
    caption: 'title',
    instructions: null,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::string',
  },
};
const nameField = {
  type: 'fields',
  id: 'name',
  attributes: {
    'is-metadata': true,
    caption: 'name',
    instructions: null,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::string',
  },
};
const authorField = {
  type: 'fields',
  id: 'author',
  attributes: {
    'is-metadata': true,
    caption: 'author',
    instructions: null,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::belongs-to',
  },
};
const reviewersField = {
  type: 'fields',
  id: 'reviewers',
  attributes: {
    'is-metadata': true,
    caption: 'reviewers',
    instructions: null,
    'needed-when-embedded': true,
    'field-type': '@cardstack/core-types::has-many',
  },
};

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').withAttributes({
      sourceType: '@cardstack/mock-auth',
      mayCreateUser: true,
      params: {
        users: {
          'sample-user': { verified: true },
        },
      },
    });
    factory
      .addResource('grants')
      .withAttributes({
        mayWriteFields: true,
        mayReadFields: true,
        mayCreateResource: true,
        mayReadResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayLogin: true,
      })
      .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
  },

  destroy() {
    return [
      // Deleting these in descending order so we can ensure all artifacts are removed
      // cleanly and no orphaned card resources are left in the index
      // (deleting children before parents)
      { type: 'cards', id: card7Id },
      { type: 'cards', id: card6Id },
      { type: 'cards', id: card5Id },
      { type: 'cards', id: card4Id },
      { type: 'cards', id: card3Id },
      { type: 'cards', id: card2Id },
      { type: 'cards', id: card1Id },
    ];
  },
});

function assertCardHasIsolatedFields(assert, card) {
  assert.equal(card.loadedFormat, 'isolated', 'the card format is correct');
  let fields = card.isolatedFields;
  assert.equal(fields.length, 3);
  assert.equal(fields[0].name, 'title');
  assert.equal(fields[0].value, 'test title');
  assert.equal(fields[0].type, '@cardstack/core-types::string');
  assert.equal(fields[0].neededWhenEmbedded, true);

  assert.equal(fields[1].name, 'body');
  assert.equal(fields[1].value, 'test body');
  assert.equal(fields[1].type, '@cardstack/core-types::string');
  assert.equal(fields[1].neededWhenEmbedded, false);

  assert.equal(fields[2].name, 'author');
  assert.equal(fields[2].value.id, card2Id);
  assert.equal(fields[2].type, '@cardstack/core-types::belongs-to');
  assert.equal(fields[2].neededWhenEmbedded, true);
}

function assertCardHasEmbeddedFields(assert, card) {
  let fields = card.embeddedFields;
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, 'title');
  assert.equal(fields[0].value, 'test title');
  assert.equal(fields[0].type, '@cardstack/core-types::string');
  assert.equal(fields[0].neededWhenEmbedded, true);

  assert.equal(fields[1].name, 'author');
  assert.equal(fields[1].value.id, card2Id);
  assert.equal(fields[1].type, '@cardstack/core-types::belongs-to');
  assert.equal(fields[1].neededWhenEmbedded, true);
}

module('Unit | Service | data', function() {
  module('add card', function(hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function() {
      await this.owner
        .lookup('service:mock-login')
        .get('login')
        .perform('sample-user');
      this.owner.lookup('service:data')._clearCache();
    });

    hooks.afterEach(async function() {
      this.owner.lookup('service:data')._clearCache();
    });

    test('it creates new card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.equal(card.id, card1Id, 'the card ID is correct');
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': [],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [],
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
            },
          },
          included: [{ type: card1Id, id: card1Id }],
        },
        'the card JSON is correct for a new card'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
      assert.equal(card.loadedFormat, 'isolated', 'the loaded state is correct for a new card');
      assert.equal(card.isNew, true, 'the isNew state is correct for a new card');
    });

    test('it throws an error when the card id format has no respository indicator', async function(assert) {
      let service = this.owner.lookup('service:data');
      assert.throws(() => service.createCard('article-card'), /format is incorrect/);
    });

    test('it throws an error when the card id format has 3 parts', async function(assert) {
      let service = this.owner.lookup('service:data');
      assert.throws(() => service.createCard('local-hub::foo::bar'), /format is incorrect/);
    });

    test('it can add a new field to an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['title'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'title' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [{ type: card1Id, id: card1Id }, titleField],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can add a new field with a label', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'title',
        label: 'The Title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
      });

      assert.equal(field.label, 'The Title');
      let json = card.json;
      let fieldJson = json.included.find(i => `${i.type}/${i.id}` === 'fields/title');
      assert.equal(fieldJson.attributes.caption, 'The Title');

      await card.save();

      card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').label, 'The Title');
    });

    test('it can add a new field with instructions', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        instructions: 'test instructions',
      });

      assert.equal(field.instructions, 'test instructions');
      let json = card.json;
      let fieldJson = json.included.find(i => `${i.type}/${i.id}` === 'fields/title');
      assert.equal(fieldJson.attributes.instructions, 'test instructions');
    });

    test('it can set isolated css', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.setIsolatedCss('.isolated-card { color: pink; }');

      assert.equal(card.isolatedCss, '.isolated-card { color: pink; }');
      let json = card.json;
      assert.equal(json.data.attributes['isolated-css'], '.isolated-card { color: pink; }');
    });

    test('it can set embedded css', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.setEmbeddedCss('.embedded-card { color: pink; }');

      assert.equal(card.embeddedCss, '.embedded-card { color: pink; }');
      let json = card.json;
      assert.equal(json.data.attributes['embedded-css'], '.embedded-card { color: pink; }');
    });

    test('it can add a new field to an isolated card at the first position', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field1 = card.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let field2 = card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let field3 = card.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        position: 0,
      });

      assert.equal(field1.position, 1);
      assert.equal(field2.position, 2);
      assert.equal(field3.position, 0);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'name']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['title', 'body', 'name']);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can add a new field to an isolated card at the last position', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field1 = card.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let field2 = card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let field3 = card.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        position: 2,
      });

      assert.equal(field1.position, 0);
      assert.equal(field2.position, 1);
      assert.equal(field3.position, 2);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'name', 'title']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'name', 'title']);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can add a new field to an isolated card at a position in the middle', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field1 = card.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let field2 = card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let field3 = card.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        position: 1,
      });

      assert.equal(field1.position, 0);
      assert.equal(field2.position, 2);
      assert.equal(field3.position, 1);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'title', 'name']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'title', 'name']);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it throws when adding a new field with a position that is larger than the number of fields', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField({ name: 'body', type: '@cardstack/core-types::string' });
      card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      assert.throws(
        () =>
          card.addField({
            name: 'title',
            type: '@cardstack/core-types::string',
            neededWhenEmbedded: true,
            position: 3,
          }),
        /beyond the bounds of the field positions for this card/
      );
    });

    test('it throws an error when you try to add a new field with missing name', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.addField({ type: '@cardstack/core-types::string' }), /missing 'name'/);
    });

    test('it throws an error when you try to add a new field with missing type', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      assert.throws(() => card.addField({ name: 'title' }), /missing 'type'/);
    });

    test('it throws an error when you try to add a new field that has a duplicate type and id of an existing field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      card.addField({ name: 'title', type: '@cardstack/core-types::string' });
      assert.throws(
        () => card.addField({ name: 'title', type: '@cardstack/core-types::string' }),
        /field 'fields\/title' which already exists for this card/
      );
    });

    test('it can set an attribute field value on an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      field.setValue('Millenial Puppies');
      assert.equal(field.value, 'Millenial Puppies');
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['title'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'title' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [
            {
              type: card1Id,
              id: card1Id,
              attributes: {
                title: 'Millenial Puppies',
              },
            },
            titleField,
          ],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can set a belongs-to relationship field on an isolated card by card id', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
      });
      field.setValue(card2Id);
      assert.equal(field.value.constructor.name, 'Card');
      assert.equal(field.value.id, card2Id);
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['author'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'author' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [
            {
              type: card1Id,
              id: card1Id,
              relationships: {
                author: {
                  data: { type: 'cards', id: card2Id },
                },
              },
            },
            authorField,
          ],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can set a belongs-to relationship field on an isolated card by card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
      });
      field.setValue(person);
      assert.equal(field.value, person);
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['author'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'author' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [
            {
              type: card1Id,
              id: card1Id,
              relationships: {
                author: {
                  data: { type: 'cards', id: card2Id },
                },
              },
            },
            authorField,
          ],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test("it can set a has-many relationship field on an isolated card by card id's", async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
      });
      field.setValue([card2Id]);
      assert.equal(field.value[0].constructor.name, 'Card');
      assert.equal(field.value[0].id, card2Id);
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['reviewers'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'reviewers' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [
            {
              type: card1Id,
              id: card1Id,
              relationships: {
                reviewers: {
                  data: [{ type: 'cards', id: card2Id }],
                },
              },
            },
            reviewersField,
          ],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can set a has-many relationship field on an isolated card by card instances', async function(assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
      });
      field.setValue([person]);
      assert.deepEqual(field.value, [person]);
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': ['reviewers'],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [{ type: 'fields', id: 'reviewers' }],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [
            {
              type: card1Id,
              id: card1Id,
              relationships: {
                reviewers: {
                  data: [{ type: 'cards', id: card2Id }],
                },
              },
            },
            reviewersField,
          ],
        },
        'the card JSON is correct for adding a string field'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it throws an error if you try to set a has-many relationship with a non-array value', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
      });
      assert.throws(() => field.setValue(card2Id), /value must be an array of Cards/);
    });

    test('it can remove an attribute type field from an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      let field = card.addField({ name: 'title', type: '@cardstack/core-types::string' });
      field.setValue('Millenial Puppies');
      assert.equal(field.isDestroyed, false, 'the field destroyed state is correct');
      field.remove();

      assert.equal(field.isDestroyed, true, 'the field destroyed state is correct');
      assert.notOk(card.fields.find(i => i.name === 'title'));
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': [],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [{ type: card1Id, id: card1Id }],
        },
        'the card JSON is correct for a new card'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
    });

    test('it can remove a relationship type field from an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let card = service.createCard(card1Id);
      let field = card.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
      });
      field.setValue(person);
      field.remove();

      assert.equal(field.isDestroyed, true, 'the field destroyed state is correct');
      assert.notOk(card.fields.find(i => i.name === 'author'));
      assert.deepEqual(
        card.json,
        {
          data: {
            id: card1Id,
            type: 'cards',
            attributes: {
              'field-order': [],
              'isolated-css': null,
              'embedded-css': null,
            },
            relationships: {
              fields: {
                data: [],
              },
              'adopted-from': {
                data: { type: 'cards', id: 'local-hub::@cardstack/base-card' },
              },
              model: {
                data: { type: card1Id, id: card1Id },
              },
            },
          },
          included: [{ type: card1Id, id: card1Id }],
        },
        'the card JSON is correct for a new card'
      );
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
    });

    test('it can save a new card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      let name = person.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let email = person.addField({ name: 'email', type: '@cardstack/core-types::string' });
      name.setValue('Van Gogh');
      email.setValue('vangogh@nowhere.dog');
      await person.save();

      let article = service.createCard(card1Id);
      let title = article.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      let body = article.addField({ name: 'body', type: '@cardstack/core-types::string' });
      let author = article.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
      });
      title.setValue('test title');
      body.setValue('test body');
      author.setValue(person);
      await article.save();

      let field = article.getField('author');
      assert.equal(field.label, 'author');
      assert.equal(field.value.constructor.name, 'Card');
      assert.equal(field.value.id, person.id);
      assert.equal(article.getField('title').value, 'test title');
      assert.equal(article.getField('title').label, 'title');
      assert.equal(article.getField('body').value, 'test body');
      assert.equal(article.getField('body').label, 'body');

      assertCardHasIsolatedFields(assert, article);
      assert.equal(article.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(article.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(article.loadedFormat, 'isolated', 'the loaded state is correct for a saved card');
    });

    test('a card will adopt the @cardstack/base-card by default', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card1Id);
      await card.save();

      let parent = card.adoptedFrom;
      assert.equal(parent.constructor.name, 'Card');
      assert.equal(parent.id, 'local-hub::@cardstack/base-card');
      assert.equal(parent.adoptedFromId, null);
      let adoptedResource = card.json.included.find(
        i => `${i.type}/${i.id}` === 'cards/local-hub::@cardstack/base-card'
      );
      assert.ok(adoptedResource);
      assert.equal(card.adoptedFromId, 'local-hub::@cardstack/base-card');
      assert.equal(card.adoptedFromName, '@cardstack/base-card');
    });

    test('a card can specify a card that it adopts from', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      parent.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      await parent.save();

      let card = service.createCard(card2Id, parent);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a new card');
      assert.equal(card.isNew, true, 'the isNew state is correct for a new card');
      assert.notOk(
        card.json.data.relationships.fields.data.find(i => i.id === 'title'),
        'adopted field does not appear in card fields relationships'
      );
      assert.notOk(
        card.json.data.relationships.fields.data.find(i => i.id === 'body'),
        'adopted field does not appear in card fields relationships'
      );
      assert.notOk(
        card.json.included.find(i => i.id === 'title'),
        'adopted field schema does not appear in card included'
      );
      assert.notOk(
        card.json.included.find(i => i.id === 'body'),
        'adopted field schema does not appear in card included'
      );
      assert.equal(card.getField('title').isAdopted, true);
      assert.equal(card.getField('title').type, '@cardstack/core-types::string');
      assert.equal(card.getField('title').neededWhenEmbedded, true);
      assert.equal(card.getField('title').value, undefined);

      assert.equal(card.getField('body').isAdopted, true);
      assert.equal(card.getField('body').type, '@cardstack/core-types::string');
      assert.equal(card.getField('body').neededWhenEmbedded, false);
      assert.equal(card.getField('body').value, undefined);

      card.getField('title').setValue('child title');
      card.getField('body').setValue('child body');
      card.addField({ name: 'name', type: '@cardstack/core-types::string', value: 'Van Gogh' });

      assert.equal(card.getField('name').isAdopted, false);
      assert.equal(card.adoptedFrom, parent);
      assert.equal(card.adoptedFromId, parent.id);
      assert.equal(card.adoptedFromName, parent.name);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'name']
      );

      await card.save();

      service._clearCache();
      card = await service.getCard(card.id, 'isolated');
      assert.equal(card.isDirty, false, 'the dirtiness is correct');
      assert.equal(card.isNew, false, 'the isNew state is correct');
      assert.equal(card.getField('title').value, 'child title');
      assert.equal(card.getField('body').value, 'child body');
      assert.equal(card.getField('name').value, 'Van Gogh');
      assert.equal(card.getField('title').isAdopted, true);
      assert.equal(card.getField('body').isAdopted, true);
      assert.equal(card.getField('name').isAdopted, false);
      assert.equal(card.adoptedFromId, parent.id);
      assert.equal(card.adoptedFromName, parent.name);

      let adoptedFrom = card.adoptedFrom;
      assert.equal(adoptedFrom.id, card1Id);
      assert.equal(adoptedFrom.loadedFormat, 'embedded');
      assert.equal(adoptedFrom.getField('title').value, 'test title');
      assert.equal(adoptedFrom.getField('body'), undefined);
      assert.equal(adoptedFrom.getField('name'), undefined);
    });

    test('it throws when you adopt from a card that is not isolated', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      parent.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      await parent.save();
      service._clearCache();

      parent = await service.getCard(card1Id, 'embedded');
      assert.throws(() => service.createCard(card2Id, parent), /must be loaded in the 'isolated' format first/);
    });

    test('it throws when you add a field that is already an adopted field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      parent.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      await parent.save();

      let card = service.createCard(card2Id, parent);
      assert.throws(
        () => card.addField({ name: 'title', type: '@cardstack/core-types::string' }),
        /'fields\/title' which already exists for this card/
      );
    });

    test('it throws when you try to remove an adopted field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      await parent.save();

      let card = service.createCard(card3Id, parent);
      assert.throws(() => card.getField('title').remove(), /adopted fields cannot be removed/);
    });

    test("it does not allow an adopted field's name to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      await parent.save();
      let card = service.createCard(card3Id, parent);

      assert.throws(() => card.getField('title').setName('subtitle'), /adopted fields cannot have their name changed/);
    });

    // TODO We need to discuss this more deeply as a team to understand what the desired behavior is here
    test("it does not allow an adopted field's label to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      await parent.save();
      let card = service.createCard(card3Id, parent);

      assert.throws(
        () => card.getField('title').setLabel('The Title'),
        /adopted fields cannot have their label changed/
      );
    });

    test("it does not allow an adopted field's needed-when-embedded to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      await parent.save();
      let card = service.createCard(card3Id, parent);

      assert.throws(
        () => card.getField('title').setNeededWhenEmbedded(false),
        /adopted fields cannot have their neededWhenEmbedded value changed/
      );
    });

    test('it throws when you try to create a card whose adopted parent has not yet been saved', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });

      assert.throws(
        () => service.createCard(card3Id, parent),
        /the card you are trying to adopt 'local-hub::millenial-puppies' has not been saved yet/
      );
    });

    test('it allows a card to call setAdoptedFrom before it has been saved', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      await parent.save();

      let card = service.createCard(card3Id);
      card.setAdoptedFrom(parent);
      card.getField('title').setValue('test title');
      await card.save();

      assert.equal(card.adoptedFrom.id, parent.id);
      assert.equal(card.getField('title').value, 'test title');
    });
  });

  module('get card', function(hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function() {
      await this.owner
        .lookup('service:mock-login')
        .get('login')
        .perform('sample-user');

      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      person.addField({
        name: 'name',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'Van Gogh',
      });
      person.addField({ name: 'email', type: '@cardstack/core-types::string', value: 'vangogh@nowhere.dog' });
      await person.save();

      let article = service.createCard(card1Id);
      article.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      article.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      article.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
        value: person,
      });
      await article.save();

      service._clearCache();
    });

    hooks.afterEach(async function() {
      this.owner.lookup('service:data')._clearCache();
    });

    test('it throws when you call adoptedFrom on a card that has only been loaded in the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.adoptedFrom, /must be loaded in the isolated format/);
    });

    test('it allows adoptedFromId and adoptedFromName to be called on a card that has only been loaded in the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.adoptedFromId, 'local-hub::@cardstack/base-card');
      assert.equal(card.adoptedFromName, '@cardstack/base-card');
    });

    test('it can get all cards in the store', async function(assert) {
      let service = this.owner.lookup('service:data');
      let cards = await service.allCardsInStore();
      assert.equal(cards.length, 0);

      await service.getCard(card1Id, 'isolated');
      cards = await service.allCardsInStore();
      assert.equal(cards.length, 3);
      let [card1, baseCard, card2] = cards;
      assert.equal(baseCard.id, 'local-hub::@cardstack/base-card');
      assertCardHasIsolatedFields(assert, card1);

      assert.equal(card2.loadedFormat, 'embedded');
      let fields = card2.embeddedFields;
      assert.equal(fields.length, 1);
      let [field] = fields;
      assert.equal(field.name, 'name');
      assert.equal(field.value, 'Van Gogh');

      await service.getCard(card2Id, 'isolated');
      cards = await service.allCardsInStore();
      assert.equal(cards.length, 3);
      [card1, card2] = cards;
      assertCardHasIsolatedFields(assert, card1);
      assert.equal(card2.loadedFormat, 'isolated');
      fields = card2.isolatedFields;
      assert.equal(fields.length, 2);
      let [field1, field2] = fields;
      assert.equal(field1.name, 'name');
      assert.equal(field1.value, 'Van Gogh');
      assert.equal(field2.name, 'email');
      assert.equal(field2.value, 'vangogh@nowhere.dog');
    });

    test('it can get a card in the isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assertCardHasIsolatedFields(assert, card);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.loadedFormat, 'isolated', 'the loaded state is correct for a saved card');
      assert.equal(card.name, 'millenial-puppies');
      assert.equal(card.repository, 'local-hub');
    });

    test('it can load field values of included embedded cards synchronously', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      let field = card.getField('author');
      assert.equal(field.value.getField('name').value, 'Van Gogh');
    });

    test('it can get a card in the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');

      assertCardHasEmbeddedFields(assert, card);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'author']
      );
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.loadedFormat, 'embedded', 'the loaded state is correct for a saved card');
    });

    test('it can load the isolated format of an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');

      assertCardHasIsolatedFields(assert, card);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.loadedFormat, 'isolated', 'the loaded state is correct for a saved card');
    });

    test('it can load the embedded format of an isolated card which does not alter the fields that have been loaded', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.load('embedded');

      assertCardHasEmbeddedFields(assert, card);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a saved card');
      assert.equal(card.isNew, false, 'the newness state is correct for a saved card');
      assert.equal(card.loadedFormat, 'isolated', 'the loaded state is correct for a saved card');
    });

    test('it returns the embedded fields of the card when the card has retrieved in the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');

      assert.deepEqual(
        card.embeddedFields.map(i => i.name),
        ['title', 'author']
      );
    });

    test('it returns the embedded fields of the card when the card has loaded the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('embedded');

      assert.deepEqual(
        card.embeddedFields.map(i => i.name),
        ['title', 'author']
      );
    });

    test('it returns the isolated fields of the card when the card has retreived in the isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assert.deepEqual(
        card.isolatedFields.map(i => i.name),
        ['title', 'body', 'author']
      );
    });

    test('it returns the isolated fields of the card when the card has loaded the isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');

      assert.deepEqual(
        card.isolatedFields.map(i => i.name),
        ['title', 'body', 'author']
      );
    });

    test('it returns the embedded fields of the card when the card has been retrieved in the isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assert.deepEqual(
        card.embeddedFields.map(i => i.name),
        ['title', 'author']
      );
    });

    test('it returns the embedded fields of the card when the card has loaded the isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');

      assert.deepEqual(
        card.embeddedFields.map(i => i.name),
        ['title', 'author']
      );
    });

    test('it throws an error when you try to get the isolated fields of the card when the card has only loaded the embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');

      assert.throws(() => card.isolatedFields, /card has not loaded isolated format/);
    });

    test('it throws an error when you try to get a card in an unknown format', async function(assert) {
      let service = this.owner.lookup('service:data');
      await assert.rejects(service.getCard(card1Id, 'foo'), /unknown format specified/);
    });

    test('it throws an error when you try to get a card that does not exist', async function(assert) {
      let service = this.owner.lookup('service:data');
      await assert.rejects(service.getCard('local-hub::does-not-exist', 'isolated'), /Not Found/);
    });

    test('it throws an error when you try to load a card in an unknown format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await assert.rejects(card.load('foo'), /unknown format specified/);
    });

    test('load() will update card with any updated field values', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let cardDoc = card.json;
      let index = cardDoc.included.findIndex(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      cardDoc.included[index].attributes.title = 'updated title';
      await updateCard(card1Id, cardDoc);
      assert.equal(card.json.data.attributes.title, 'test title', 'the field value is correct');
      await card.load('isolated');
      assert.equal(card.json.data.attributes.title, 'updated title', 'the field value is correct');
    });

    test('it can load a cached embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      await service.getCard(card1Id, 'isolated'); // the act of getting this card caches the embedded resources

      let card = await service.getCard(card2Id, 'embedded');
      assert.equal(card.id, card2Id, 'the card id is correct');
      assert.equal(card.loadedFormat, 'embedded', 'the card loaded state is correct');
      assert.equal(card.isNew, false, 'the card new state is correct');
      assert.equal(card.isDirty, false, 'the card dirty state is correct');
      assert.equal(card.getField('name').value, 'Van Gogh', 'the embedded card value is correct');
      assert.equal(card.getField('email'), undefined, 'the embedded card value is correct');
    });

    test('it can get the value of an attribute-type field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').value, 'test title');
    });

    test("it can get a field by the field's nonce", async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let nonce = card.getField('title').nonce;
      assert.equal(card.getFieldByNonce(nonce).value, 'test title');
    });

    test('it can get the value of a belongs-to field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let authorCard = card.getField('author').value;

      assert.equal(authorCard.constructor.name, 'Card', 'the card instance is the correct class');
      assert.equal(authorCard.id, card2Id, 'the card id is correct');
      assert.equal(authorCard.loadedFormat, 'embedded', 'the card loaded state is correct');
      assert.equal(authorCard.isNew, false, 'the card new state is correct');
      assert.equal(authorCard.isDirty, false, 'the card dirty state is correct');
    });

    test('it can get the value of a has-many field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let reviewers = card.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
      });
      reviewers.setValue([card2Id]);
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      let cards = card.getField('reviewers').value;
      assert.equal(cards.length, 1, 'the number of related cards is correct');
      let [reviewerCard] = cards;
      assert.equal(reviewerCard.constructor.name, 'Card', 'the card instance is the correct class');
      assert.equal(reviewerCard.id, card2Id, 'the card id is correct');
      assert.equal(reviewerCard.loadedFormat, 'embedded', 'the card loaded state is correct');
      assert.equal(reviewerCard.isNew, false, 'the card new state is correct');
      assert.equal(reviewerCard.isDirty, false, 'the card dirty state is correct');
    });

    test('it can get the value of an empty has-many relationship', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField({ name: 'reviewers', type: '@cardstack/core-types::has-many', neededWhenEmbedded: true });
      await card.save();
      service._clearCache();

      card = await service.getCard(card1Id, 'isolated');
      assert.deepEqual(card.getField('reviewers').value, [], 'the empty has-many field value is correct');
    });

    test('it returns undefined when you try to get a field that is only available in the isolated format when the card is embedded', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(card.getField('body'), undefined, 'the embedded card value is correct');
    });

    test("it can get a field's type", async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').type, '@cardstack/core-types::string', 'the field type is correct');
    });

    test("it can get a field's neededWhenEmbedded value", async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('title').neededWhenEmbedded, true, 'the neededWhenEmbedded value is correct');
      assert.equal(card.getField('body').neededWhenEmbedded, false, 'the neededWhenEmbedded value is correct');
    });

    test('it returns undefined when you try to get a field type that is only available in the isolated format when the card is embedded', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.equal(
        card.getField('body'),
        undefined,
        'the field does not exist when the card is in the embedded format'
      );
    });

    test('it can return an isolated only field after loading an embedded card as an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      await card.load('isolated');
      assert.equal(card.getField('body').value, 'test body', 'the field value is correct');
    });

    test('it still returns isolated-only fields if a card loaded as an isolated card was requested to be loaded as an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.load('embedded');
      assert.equal(card.getField('body').value, 'test body', 'the field value is correct');
    });

    test("it returns undefined when you get a field that doesn't exist", async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.getField('foo'), undefined);
    });

    test('it can return all the fields for an isolated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author'],
        'the fields are correct'
      );
    });

    test('it can return all the fields for an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'author'],
        'the fields are correct'
      );
    });

    test('it can get the instructions for a field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card3Id);
      card.addField({ name: 'title', type: '@cardstack/core-types::string', instructions: 'test instructions' });
      await card.save();

      service._clearCache();
      card = await service.getCard(card3Id, 'isolated');
      assert.equal(card.getField('title').instructions, 'test instructions');
    });
  });

  module('update card', function(hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function() {
      await this.owner
        .lookup('service:mock-login')
        .get('login')
        .perform('sample-user');

      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      person.addField({
        name: 'name',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'Van Gogh',
      });
      person.addField({ name: 'email', type: '@cardstack/core-types::string', value: 'vangogh@nowhere.dog' });
      await person.save();

      let article = service.createCard(card1Id);
      article.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      article.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      article.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
        value: person,
      });
      await article.save();

      service._clearCache();
    });

    hooks.afterEach(async function() {
      this.owner.lookup('service:data')._clearCache();
    });

    test('it can update isolated css', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assert.equal(card.isDirty, false, 'the dirtiness is correct for card');
      card.setIsolatedCss('.isolated-card { color: pink; }');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for card');

      assert.equal(card.isolatedCss, '.isolated-card { color: pink; }');
      assert.equal(card.json.data.attributes['isolated-css'], '.isolated-card { color: pink; }');
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for card');
      assert.equal(card.isolatedCss, '.isolated-card { color: pink; }');

      service._clearCache();
      card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isolatedCss, '.isolated-card { color: pink; }');
    });

    test('it can update embedded css', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');

      assert.equal(card.isDirty, false, 'the dirtiness is correct for card');
      card.setEmbeddedCss('.embedded-card { color: pink; }');
      assert.equal(card.isDirty, true, 'the dirtiness is correct for card');

      assert.equal(card.embeddedCss, '.embedded-card { color: pink; }');
      assert.equal(card.json.data.attributes['embedded-css'], '.embedded-card { color: pink; }');
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for card');
      assert.equal(card.embeddedCss, '.embedded-card { color: pink; }');

      service._clearCache();
      card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.embeddedCss, '.embedded-card { color: pink; }');
    });

    test('it throws when the card is not fully loaded and setIsolatedCss is called', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.setIsolatedCss('.card {}'), /not fully loaded/);
    });

    test('it throws when the card is not fully loaded and setEmbeddedCss is called', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(() => card.setEmbeddedCss('.card {}'), /not fully loaded/);
    });

    test('it can add a new field to an existing card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });

      assert.deepEqual(card.json.included.pop(), nameField);
      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.deepEqual(cardDoc.data.relationships.fields.data, [
        { type: 'fields', id: 'title' },
        { type: 'fields', id: 'body' },
        { type: 'fields', id: 'author' },
        { type: 'fields', id: 'name' },
      ]);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
    });

    test('it can change the name of a field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');

      assert.equal(field.label, 'title');
      field.setName('subtitle');

      assert.equal(card.isDirty, true, 'the dirtiness is correct for card');
      assert.equal(field.name, 'subtitle');
      assert.equal(field.label, 'Subtitle');
      assert.equal(field.value, 'test title');
      assert.equal(card.getField('title'), undefined);
      assert.equal(card.getField('subtitle').name, 'subtitle');
      assert.equal(card.getField('subtitle').value, 'test title');
      assert.equal(
        Boolean(card.json.data.relationships.fields.data.find(i => `${i.type}/${i.id}` === 'fields/subtitle')),
        true,
        'updated field schema reference exists'
      );
      assert.equal(
        !card.json.data.relationships.fields.data.find(i => `${i.type}/${i.id}` === 'fields/title'),
        true,
        'old field schema reference doesnt exist'
      );
      assert.equal(
        Boolean(card.json.included.find(i => `${i.type}/${i.id}` === 'fields/subtitle')),
        true,
        'updated field included resources exists'
      );
      assert.equal(
        !card.json.included.find(i => `${i.type}/${i.id}` === 'fields/title'),
        true,
        'old field included resource does not exist'
      );
      let model = card.json.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.subtitle, 'test title');
      assert.equal(model.attributes.title, undefined);

      await card.save();
      assert.equal(card.isDirty, false, 'the dirtiness is correct saved card');
      field = card.getField('subtitle');

      assert.equal(field.name, 'subtitle');
      assert.equal(field.label, 'Subtitle');
      assert.equal(field.value, 'test title');
      assert.equal(card.getField('title'), undefined);
      assert.equal(card.getField('subtitle').name, 'subtitle');
      assert.equal(card.getField('subtitle').label, 'Subtitle');
      assert.equal(card.getField('subtitle').value, 'test title');
      assert.equal(
        Boolean(card.json.data.relationships.fields.data.find(i => `${i.type}/${i.id}` === 'fields/subtitle')),
        true,
        'updated field schema reference exists'
      );
      assert.equal(
        !card.json.data.relationships.fields.data.find(i => `${i.type}/${i.id}` === 'fields/title'),
        true,
        'old field schema reference doesnt exist'
      );
      assert.equal(
        Boolean(card.json.included.find(i => `${i.type}/${i.id}` === 'fields/subtitle')),
        true,
        'updated field included resources exists'
      );
      assert.equal(
        !card.json.included.find(i => `${i.type}/${i.id}` === 'fields/title'),
        true,
        'old field included resource does not exist'
      );
      model = card.json.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.subtitle, 'test title');
      assert.equal(model.attributes.title, undefined);
    });

    test('it can change the label of a field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');

      assert.equal(field.label, 'title');
      assert.equal(card.isDirty, false);

      field.setLabel('The Title');
      assert.equal(card.isDirty, true);
      assert.equal(field.label, 'The Title');
      await card.save();

      assert.equal(card.isDirty, false);
      field = card.getField('title');
      assert.equal(field.label, 'The Title');
    });

    test('it can change the instructions of a field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card3Id);
      card.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        instructions: 'it puts the lotion on its skin',
      });
      await card.save();

      let field = card.getField('title');
      assert.equal(card.isDirty, false);
      assert.equal(field.instructions, 'it puts the lotion on its skin');

      field.setInstructions('it puts the lotion in the basket');
      assert.equal(card.isDirty, true);
      assert.equal(field.instructions, 'it puts the lotion in the basket');
      await card.save();

      assert.equal(card.isDirty, false);
      field = card.getField('title');
      assert.equal(field.instructions, 'it puts the lotion in the basket');
    });

    test('when the field is set to an empty string, the name of the field is returned as the label', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');

      assert.equal(field.label, 'title');
      assert.equal(card.isDirty, false);

      field.setLabel('');
      assert.equal(card.isDirty, true);
      assert.equal(field.label, 'title');
      await card.save();

      assert.equal(card.isDirty, false);
      field = card.getField('title');
      assert.equal(field.label, 'title');
    });

    skip("TODO updating a card does not impact any of the card's internal fields", async function(/*assert*/) {});

    test('it does nothing if the field name is changed to the same name that it currently is', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');

      field.setName('title');
      assert.equal(card.isDirty, false, 'the dirtiness is correct saved card');
      assert.equal(field.name, 'title');
      assert.equal(field.value, 'test title');
      assert.equal(card.getField('title').name, 'title');
      assert.equal(card.getField('title').value, 'test title');
    });

    test('it can remove a field from an existing card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let title = card.getField('title');
      title.remove();

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.deepEqual(cardDoc.data.relationships.fields.data, [
        { type: 'fields', id: 'body' },
        { type: 'fields', id: 'author' },
      ]);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.title, undefined, 'the title model data no longer exists');
      assert.notOk(cardDoc.included.find(i => `${i.type}/${i.id}` === `fields/title`));
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.equal(title.isDestroyed, true, 'the destroyed state is correct for removed field');
    });

    test('it can set a attribute type field value in an existing card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.getField('title').setValue('updated title');

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.equal(model.attributes.title, 'updated title');
      assert.equal(cardDoc.data.attributes.title, 'test title'); // card metadata is not updated until after the card is saved
    });

    test('it can set a belongs-to relationship field value in an existing card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.getField('author').setValue(service.createCard(card3Id));

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      let model = cardDoc.included.find(i => `${i.type}/${i.id}` === `${card1Id}/${card1Id}`);
      assert.deepEqual(model.relationships.author.data, { type: 'cards', id: card3Id });
      assert.deepEqual(cardDoc.data.relationships.author.data, { type: 'cards', id: card2Id }); // card metadata is not updated until after the card is saved
    });

    test('it can set a has-many relationship field value in an existing card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let reviewers = card.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
      });
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
        { type: 'cards', id: card3Id },
      ]);
      assert.deepEqual(cardDoc.data.relationships.reviewers.data, [
        { type: 'cards', id: card2Id }, // card metadata is not updated until after the card is saved
      ]);
    });

    test('it can save an updated card when it is an isolated format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      card.getField('title').setValue('updated title');
      await card.save();

      let cardDoc = cleanupDefaulValueArtifacts(card.json);
      assert.equal(card.getField('title').value, 'updated title');
      assert.equal(cardDoc.data.attributes.title, 'updated title');
    });

    test('it can save an updated card when it is an embedded format', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      card.getField('title').setValue('updated title');
      await card.save();

      let fields = card.embeddedFields;
      assert.equal(fields.length, 2);
      assert.equal(fields[0].name, 'title');
      assert.equal(fields[0].value, 'updated title');
      assert.equal(fields[1].name, 'author');
      assert.equal(fields[1].value.id, card2Id);

      await card.load('isolated');
      fields = card.embeddedFields;
      assert.equal(fields.length, 2);
      assert.equal(fields[0].name, 'title');
      assert.equal(fields[0].value, 'updated title');
      assert.equal(fields[1].name, 'author');
      assert.equal(fields[1].value.id, card2Id);

      fields = card.isolatedFields;
      assert.equal(fields.length, 3);
      assert.equal(fields[0].name, 'title');
      assert.equal(fields[0].value, 'updated title');
      assert.equal(fields[1].name, 'author');
      assert.equal(fields[1].value.id, card2Id);
      assert.equal(fields[2].name, 'body');
      assert.equal(fields[2].value, 'test body');
    });

    test('it invalidates cards that contain the updated card as a belongs-to relationship', async function(assert) {
      let service = this.owner.lookup('service:data');
      let article = await service.getCard(card1Id, 'embedded'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');
      article = await service.getCard(card1Id, 'isolated'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');

      let person = await service.getCard(card2Id, 'isolated');
      person.getField('name').setValue('updated name');
      await person.save();

      article = await service.getCard(card1Id, 'embedded');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
      article = await service.getCard(card1Id, 'isolated');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
    });

    test('it invalidates cards that contain the updated card as a has-many relationship', async function(assert) {
      let service = this.owner.lookup('service:data');
      let anotherPerson = service.createCard(card3Id);
      anotherPerson.addField({
        name: 'name',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'Hassan',
      });
      anotherPerson.addField({ name: 'email', type: '@cardstack/core-types::string', value: 'hassan@nowhere.dog' });
      await anotherPerson.save();

      let person = await service.getCard(card2Id, 'isolated');
      let article = await service.getCard(card1Id, 'isolated');
      article.addField({
        name: 'reviewers',
        type: '@cardstack/core-types::has-many',
        neededWhenEmbedded: true,
        value: [person, anotherPerson],
      });
      await article.save();
      service._clearCache();

      article = await service.getCard(card1Id, 'embedded'); // load the card to be invalidated into the store
      assert.equal(article.getField('reviewers').value[0].getField('name').value, 'Van Gogh');
      article = await service.getCard(card1Id, 'isolated'); // load the card to be invalidated into the store
      assert.equal(article.getField('reviewers').value[0].getField('name').value, 'Van Gogh');

      person = await service.getCard(card2Id, 'isolated');
      person.getField('name').setValue('updated name');
      await person.save();

      article = await service.getCard(card1Id, 'embedded');
      assert.equal(article.getField('reviewers').value[0].getField('name').value, 'updated name');
      article = await service.getCard(card1Id, 'isolated');
      assert.equal(article.getField('reviewers').value[0].getField('name').value, 'updated name');
    });

    test('it invalidates cards that contain the updated card when card is updated as owned relationships (aka embedded card update)', async function(assert) {
      let service = this.owner.lookup('service:data');
      let article = await service.getCard(card1Id, 'embedded'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');
      article = await service.getCard(card1Id, 'isolated'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');

      let person = await service.getCard(card2Id, 'embedded');
      person.getField('name').setValue('updated name');
      await person.save();

      article = await service.getCard(card1Id, 'embedded');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
      article = await service.getCard(card1Id, 'isolated');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
    });

    test('it invalidates cards that contain a card that was updated on the server since the last time it was loaded', async function(assert) {
      let service = this.owner.lookup('service:data');
      let article = await service.getCard(card1Id, 'embedded'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');
      article = await service.getCard(card1Id, 'isolated'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');

      let person = await service.getCard(card2Id, 'isolated');
      let cardDoc = person.json;
      let index = cardDoc.included.findIndex(i => `${i.type}/${i.id}` === `${card2Id}/${card2Id}`);
      cardDoc.included[index].attributes.name = 'updated name';
      await updateCard(card2Id, cardDoc);
      await person.load('isolated');

      article = await service.getCard(card1Id, 'embedded');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
      article = await service.getCard(card1Id, 'isolated');
      assert.equal(article.getField('author').value.getField('name').value, 'updated name');
    });

    test('it can change a needed-when-embedded field to be an isolated-only field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      assert.equal(field.neededWhenEmbedded, true);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');

      field.setNeededWhenEmbedded(false);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.equal(field.neededWhenEmbedded, false);
      let fieldResource = card.json.included.find(i => `${i.type}/${i.id}` === 'fields/title');
      assert.equal(fieldResource.attributes['needed-when-embedded'], false);
      await card.save();

      assert.equal(card.getField('title').neededWhenEmbedded, false);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      fieldResource = card.json.included.find(i => `${i.type}/${i.id}` === 'fields/title');
      assert.equal(fieldResource.attributes['needed-when-embedded'], false);
    });

    test('it can change an isolated-only field to be a needed-when-embedded field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('body');
      assert.equal(field.neededWhenEmbedded, false);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');

      field.setNeededWhenEmbedded(true);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.equal(field.neededWhenEmbedded, true);
      let fieldResource = card.json.included.find(i => `${i.type}/${i.id}` === 'fields/body');
      assert.equal(fieldResource.attributes['needed-when-embedded'], true);
      await card.save();

      assert.equal(card.getField('body').neededWhenEmbedded, true);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      fieldResource = card.json.included.find(i => `${i.type}/${i.id}` === 'fields/body');
      assert.equal(fieldResource.attributes['needed-when-embedded'], true);
    });

    test('it sets needed to embedded to the same value it already is', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('body');

      field.setNeededWhenEmbedded(false);
      assert.equal(card.isDirty, false, 'the dirtiness is correct');
      assert.equal(field.neededWhenEmbedded, false);
      let fieldResource = card.json.included.find(i => `${i.type}/${i.id}` === 'fields/body');
      assert.equal(fieldResource.attributes['needed-when-embedded'], false);
    });

    test('it can move the position of a field for an isolated card to the beginning', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      card.moveField(card.getField('author'), 0);

      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['author', 'title', 'body']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['author', 'title', 'body']);
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['author', 'title', 'body']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['author', 'title', 'body']);
    });

    test('it can move the position of a field for an isolated card to the end', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.equal(card.getField('title').position, 0);
      card.moveField(card.getField('title'), 2);

      assert.equal(card.getField('title').position, 2);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'author', 'title']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'author', 'title']);
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'author', 'title']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'author', 'title']);
    });

    test('it can move the position of a field for an isolated card to somewhere in the middle', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.equal(card.getField('title').position, 0);
      card.moveField(card.getField('title'), 1);

      assert.equal(card.getField('title').position, 1);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'title', 'author']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'title', 'author']);
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'title', 'author']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'title', 'author']);
    });

    test('it can move the position of a field to where it already exists', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.equal(card.getField('title').position, 0);
      card.moveField(card.getField('title'), 0);

      assert.equal(card.getField('title').position, 0);
      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['title', 'body', 'author']);
    });

    test('it can change the adoptedFrom amongst parents that define the same field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      parent1.addField({ name: 'name', type: '@cardstack/core-types::string' });
      await parent1.save();

      let parent2 = await service.getCard(card2Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      card.getField('title').setValue('test title');
      card.getField('name').setValue('test name');
      card.addField({ name: 'favorite-color', type: '@cardstack/core-types::string', value: 'purple' });
      await card.save();

      let field = card.getField('name');
      assert.equal(card.adoptedFrom.id, parent1.id);
      assert.equal(card.adoptedFromId, parent1.id);
      assert.equal(card.adoptedFromName, parent1.name);
      assert.equal(card.isDirty, false, 'the dirtiness is correct');
      assert.equal(field.isDestroyed, false);

      card.setAdoptedFrom(parent2);

      assert.equal(card.adoptedFrom.id, parent2.id);
      assert.equal(card.adoptedFromId, parent2.id);
      assert.equal(card.adoptedFromName, parent2.name);
      assert.equal(card.isDirty, true, 'the dirtiness is correct');
      assert.equal(parent2.isDirty, false, 'the dirtiness is correct');
      assert.equal(field.isDestroyed, true);
      assert.deepEqual(
        card.fields.map(i => i.name),
        [
          'favorite-color',
          // newly received adoped parent fields are just appeneded to the end
          'name',
          'email',
        ]
      );

      assert.equal(card.getField('title'), undefined);
      // note that the name field is used in both parent--but actually has different context. the data for this field
      // should not be preserved after changing the card's adoptedFrom
      assert.equal(card.getField('name').value, undefined);
      assert.equal(card.getField('favorite-color').value, 'purple');

      await card.save();
      assert.equal(card.isDirty, false, 'the dirtiness is correct');
      assert.equal(card.adoptedFrom.id, parent2.id);
      assert.equal(card.adoptedFromId, parent2.id);
      assert.equal(card.adoptedFromName, parent2.name);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['favorite-color', 'name', 'email']
      );
      assert.equal(card.getField('title'), undefined);
      assert.equal(card.getField('name').value, undefined);
      assert.equal(card.getField('favorite-color').value, 'purple');
    });

    test('it can change the adoptedFrom amongst parents that adopt the same field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let userCard = service.createCard(card4Id);
      userCard.addField({ name: 'name', type: '@cardstack/core-types::string', neededWhenEmbedded: true });
      userCard.addField({ name: 'email', type: '@cardstack/core-types::case-insensitive' });
      await userCard.save();

      let parent1 = service.createCard(card5Id, userCard);
      parent1.getField('name').setValue('Mango');
      parent1.getField('email').setValue('mango@nowhere.dog');
      parent1.addField({ name: 'favorite-toy', type: '@cardstack/core-types::string', value: 'squeaky snake' });
      await parent1.save();

      let parent2 = service.createCard(card6Id, userCard);
      parent2.getField('name').setValue('Ringo');
      parent2.getField('email').setValue('ringo@nowhere.dog');
      parent2.addField({
        name: 'favorite-color',
        type: '@cardstack/core-types::string',
        value: 'purple',
        label: 'color',
        instructions: 'black is not a color',
      });
      await parent2.save();

      let child = service.createCard(card7Id, parent1);
      child.getField('name').setValue('Musa');
      child.getField('email').setValue('musa@nowhere.com');
      child.getField('favorite-toy').setValue('legos');
      child.addField({ name: 'favorite-food', type: '@cardstack/core-types::string', value: 'hamburger' });
      await child.save();

      let grandparentField = child.getField('name');
      let parentField = child.getField('favorite-toy');
      let ownField = child.getField('favorite-food');
      assert.equal(child.adoptedFrom.id, parent1.id);
      assert.equal(child.isDirty, false, 'the dirtiness is correct');
      assert.equal(parentField.isDestroyed, false);

      child.setAdoptedFrom(parent2);

      assert.equal(child.adoptedFrom.id, parent2.id);
      assert.equal(grandparentField.isDestroyed, false);
      assert.equal(parentField.isDestroyed, true);
      assert.equal(ownField.isDestroyed, false);

      assert.deepEqual(
        child.fields.map(i => i.name),
        [
          'name',
          'email',
          'favorite-food',
          // newly received adoped parent fields are just appeneded to the end
          'favorite-color',
        ]
      );
      assert.equal(child.getField('name').value, 'Musa');
      assert.equal(child.getField('email').value, 'musa@nowhere.com');
      assert.equal(child.getField('favorite-toy'), undefined);
      assert.equal(child.getField('favorite-color').value, undefined);
      assert.equal(child.getField('favorite-food').value, 'hamburger');
      await child.save();

      assert.equal(child.adoptedFrom.id, parent2.id);
      assert.deepEqual(
        child.fields.map(i => i.name),
        ['name', 'email', 'favorite-food', 'favorite-color']
      );
      assert.equal(child.getField('name').value, 'Musa');
      assert.equal(child.getField('email').value, 'musa@nowhere.com');
      assert.equal(child.getField('favorite-toy'), undefined);
      assert.equal(child.getField('favorite-color').value, undefined);
      assert.equal(child.getField('favorite-color').instructions, 'black is not a color');
      assert.equal(child.getField('favorite-color').label, 'color');
      assert.equal(child.getField('favorite-food').value, 'hamburger');
    });

    test('it throws if card specified in setAdoptedFrom is not completely loaded', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'embedded');

      let card = service.createCard(card3Id);
      await card.save();

      assert.throws(() => card.setAdoptedFrom(parent1), /not fully loaded/);
    });

    test('it throws if card is not fully loaded when you call setAdoptedFrom', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card3Id);
      await card.save();
      service._clearCache();

      card = await service.getCard(card3Id, 'embedded');
      let parent1 = await service.getCard(card1Id, 'isolated');

      assert.throws(() => card.setAdoptedFrom(parent1), /not fully loaded/);
    });

    test('it throws when the adoptedFrom is changed to a card that has field name conflicts with the current card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card3Id);
      card.addField({ name: 'title', type: '@cardstack/core-types::string' });
      await card.save();

      let parent1 = await service.getCard(card1Id, 'isolated');
      assert.throws(() => card.setAdoptedFrom(parent1), /the field\(s\) 'title' conflict/);
    });

    test("it allows an adopted field's position to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      card.addField({ name: 'name', type: '@cardstack/core-types::string' });
      await card.save();

      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author', 'name']
      );
      card.moveField(card.getField('title'), 3);
      assert.equal(card.isDirty, true, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'author', 'name', 'title']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'author', 'name', 'title']);
      await card.save();

      assert.equal(card.isDirty, false, 'the dirtiness is correct for a modified card');
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['body', 'author', 'name', 'title']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['body', 'author', 'name', 'title']);
    });

    test("it allows a non-adopted field's position to be changed that has the side effect of changing the position of an adopted field", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      card.addField({ name: 'name', type: '@cardstack/core-types::string' });
      await card.save();

      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author', 'name']
      );
      card.moveField(card.getField('name'), 1);
      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'name', 'body', 'author']
      );
      assert.deepEqual(card.json.data.attributes['field-order'], ['title', 'name', 'body', 'author']);
      await card.save();
    });

    test("it can inherit the adopted parent card's css", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = await service.getCard(card1Id, 'isolated');
      parent.setIsolatedCss('.adopted-card-isolated { color: blue; }');
      parent.setEmbeddedCss('.adopted-card-embedded { color: blue; }');
      await parent.save();

      let card = service.createCard(card3Id, parent);
      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: blue; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: blue; }');
      await card.save();

      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: blue; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: blue; }');
      service._clearCache();

      card = await service.getCard(card3Id, 'isolated');
      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: blue; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: blue; }');
    });

    test("it can override the adopted parent card's css", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = await service.getCard(card1Id, 'isolated');
      parent.setIsolatedCss('.adopted-card-isolated { color: blue; }');
      parent.setEmbeddedCss('.adopted-card-embedded { color: blue; }');
      await parent.save();

      let card = service.createCard(card3Id, parent);
      card.setIsolatedCss('.adopted-card-isolated { color: green; }');
      card.setEmbeddedCss('.adopted-card-embedded { color: green; }');

      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: green; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: green; }');
      await card.save();

      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: green; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: green; }');
      service._clearCache();

      card = await service.getCard(card3Id, 'isolated');
      assert.equal(card.isolatedCss, '.adopted-card-isolated { color: green; }');
      assert.equal(card.embeddedCss, '.adopted-card-embedded { color: green; }');
    });

    test('a card inherits the css from a new adopted parent when the adopted parent card is changed', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      parent1.setIsolatedCss('.adopted-card-isolated { color: blue; }');
      parent1.setEmbeddedCss('.adopted-card-embedded { color: blue; }');
      await parent1.save();

      let parent2 = await service.getCard(card2Id, 'isolated');
      parent2.setIsolatedCss('.adopted-card-isolated { color: red; }');
      parent2.setEmbeddedCss('.adopted-card-embedded { color: red; }');
      await parent2.save();

      let child = service.createCard(card3Id, parent1);
      await child.save();

      child.setAdoptedFrom(parent2);
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
      await child.save();

      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
      service._clearCache();

      child = await service.getCard(card3Id, 'isolated');
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
    });

    test("when the adopted parent changes for a card, its css is set to the adopted parent's css", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      parent1.setIsolatedCss('.adopted-card-isolated { color: blue; }');
      parent1.setEmbeddedCss('.adopted-card-embedded { color: blue; }');
      await parent1.save();

      let parent2 = await service.getCard(card2Id, 'isolated');
      parent2.setIsolatedCss('.adopted-card-isolated { color: red; }');
      parent2.setEmbeddedCss('.adopted-card-embedded { color: red; }');
      await parent2.save();

      let child = service.createCard(card3Id, parent1);
      child.setIsolatedCss('.adopted-card-isolated { color: green; }');
      child.setEmbeddedCss('.adopted-card-embedded { color: green; }');
      await child.save();

      child.setAdoptedFrom(parent2);
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
      await child.save();

      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
      service._clearCache();

      child = await service.getCard(card3Id, 'isolated');
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: red; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: red; }');
    });

    test('a card can inherit css from grandparent adopted card when the adopted parent card is changed', async function(assert) {
      let service = this.owner.lookup('service:data');
      let grandparent = await service.getCard(card1Id, 'isolated');
      grandparent.setIsolatedCss('.adopted-card-isolated { color: yellow; }');
      grandparent.setEmbeddedCss('.adopted-card-embedded { color: yellow; }');
      await grandparent.save();

      let parent1 = service.createCard(card4Id, grandparent);
      parent1.setIsolatedCss('.adopted-card-isolated { color: blue; }');
      parent1.setEmbeddedCss('.adopted-card-embedded { color: blue; }');
      await parent1.save();

      let parent2 = service.createCard(card5Id, grandparent);
      await parent2.save();

      let child = service.createCard(card6Id, parent1);
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: blue; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: blue; }');
      await child.save();

      child.setAdoptedFrom(parent2);
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: yellow; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: yellow; }');
      await child.save();

      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: yellow; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: yellow; }');
      service._clearCache();

      child = await service.getCard(card6Id, 'isolated');
      assert.equal(child.isolatedCss, '.adopted-card-isolated { color: yellow; }');
      assert.equal(child.embeddedCss, '.adopted-card-embedded { color: yellow; }');
    });

    test('it does not allow an adopted field to be removed', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(() => card.getField('title').remove(), /adopted fields cannot be removed/);
    });

    test("it does not allow an adopted field's name to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(() => card.getField('title').setName('subtitle'), /adopted fields cannot have their name changed/);
    });

    // TODO We need to discuss this more deeply as a team to understand what the desired behavior is here
    test("it does not allow an adopted field's label to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(
        () => card.getField('title').setLabel('The Title'),
        /adopted fields cannot have their label changed/
      );
    });

    // TODO We need to discuss this more deeply as a team to understand what the desired behavior is here
    test("it does not allow an adopted field's instructions to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(
        () => card.getField('title').setInstructions('test instructions'),
        /adopted fields cannot have their instructions changed/
      );
    });

    test("it does not allow an adopted field's needed-when-embedded to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(
        () => card.getField('title').setNeededWhenEmbedded(false),
        /adopted fields cannot have their neededWhenEmbedded value changed/
      );
    });

    test("it does allow an adopted field's value to be changed", async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      card.getField('title').setValue('adopted title');
      assert.equal(card.getField('title').value, 'adopted title');
      await card.save();
      service._clearCache();

      card = await service.getCard(card3Id, 'embedded');
      assert.equal(card.getField('title').value, 'adopted title');
    });

    test('it throws if you try to add a field that is already an adopted field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.throws(
        () => card.addField({ name: 'title', type: '@cardstack/core-types::string' }),
        /'fields\/title' which already exists for this card/
      );
    });

    test('it throws when you try to call setAdoptedFrom to adopted from a card that has not yet been saved', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = service.createCard(card3Id);
      await card.save();

      let parent = service.createCard(card1Id);
      parent.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });

      assert.throws(
        () => card.setAdoptedFrom(parent),
        /the card you are trying to adopt 'local-hub::millenial-puppies' has not been saved yet/
      );
    });

    test('it does nothing if setAdoptedFrom is called with the same card that is already being used a the adopted-from card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent1 = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent1);
      await card.save();

      assert.equal(card.isDirty, false);
      card.setAdoptedFrom(parent1);
      assert.equal(card.isDirty, false);
    });

    test('it can invalidate cards that adopt from the updated card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = await service.getCard(card1Id, 'isolated');
      let card = service.createCard(card3Id, parent);
      await card.save();

      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      parent.addField({ name: 'favorite-color', type: '@cardstack/core-types::string' });
      await parent.save();

      card = await service.getCard(card3Id, 'isolated');
      assert.ok(card.getField('favorite-color'), 'newly added adopted field exists');
    });

    test('it can invalidate cards that adopt from the updated card one level removed', async function(assert) {
      let service = this.owner.lookup('service:data');
      let grandparent = await service.getCard(card1Id, 'isolated');
      let parent = service.createCard(card3Id, grandparent);
      await parent.save();
      let card = service.createCard(card4Id, parent);
      await card.save();

      assert.deepEqual(
        card.fields.map(i => i.name),
        ['title', 'body', 'author']
      );
      grandparent.addField({ name: 'favorite-color', type: '@cardstack/core-types::string' });
      await grandparent.save();

      card = await service.getCard(card4Id, 'isolated');
      assert.ok(card.getField('favorite-color'), 'newly added adopted field exists');
    });

    test('it throws when field specified by moveField is not an instance of Field', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.throws(() => card.moveField('title', 0), /not an instance of the Field class/);
    });

    test('it throws when field specified by moveField is a field of a different card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let differentCard = await service.getCard(card2Id, 'isolated');
      let card = await service.getCard(card1Id, 'isolated');
      assert.throws(() => card.moveField(differentCard.getField('name'), 0), /is not a field of the card/);
    });

    test('it throws when the new position specified in moveField is larger than last position (positions are 0-based)', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      assert.throws(
        () => card.moveField(card.getField('title'), 3),
        /beyond the bounds of the field positions for this card/
      );
    });

    test('it throws an error if you try to add a new field to an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      assert.throws(
        () => card.addField({ name: 'name', type: '@cardstack/core-types::string' }),
        /card is in the embedded format/
      );
    });

    test('it throws an error if you try to add a remove a field from an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('title');
      assert.throws(() => field.remove(), /card is in the embedded format/);
    });

    test('it throws an error if you try to add a move a field in an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('author');
      assert.throws(() => card.moveField(field, 0), /card is in the embedded format/);
    });

    test('it throws an error if you name a field with the same name as another field in the card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let author = card.getField('author');
      assert.throws(() => author.setName('title'), /field with the name 'title' already exists/);
    });

    test('it throws an error if you try to setNeededWhenEmbedded on an embedded card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'embedded');
      let field = card.getField('author');
      assert.throws(() => field.setNeededWhenEmbedded(false), /card is in the embedded format/);
    });
  });

  module('delete card', function(hooks) {
    setupTest(hooks);
    scenario.setupTest(hooks);

    hooks.beforeEach(async function() {
      await this.owner
        .lookup('service:mock-login')
        .get('login')
        .perform('sample-user');
      let service = this.owner.lookup('service:data');
      let person = service.createCard(card2Id);
      person.addField({
        name: 'name',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'Van Gogh',
      });
      person.addField({ name: 'email', type: '@cardstack/core-types::string', value: 'vangogh@nowhere.dog' });
      await person.save();

      let article = service.createCard(card1Id);
      article.addField({
        name: 'title',
        type: '@cardstack/core-types::string',
        neededWhenEmbedded: true,
        value: 'test title',
      });
      article.addField({ name: 'body', type: '@cardstack/core-types::string', value: 'test body' });
      article.addField({
        name: 'author',
        type: '@cardstack/core-types::belongs-to',
        neededWhenEmbedded: true,
        value: person,
      });
      await article.save();

      service._clearCache();
    });

    hooks.afterEach(async function() {
      this.owner.lookup('service:data')._clearCache();
    });

    test('it can delete a card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let { fields } = card;
      assert.equal(
        fields.every(i => !i.isDestroyed),
        true,
        'fields destroyed state is correct'
      );
      assert.equal(card.isDestroyed, false, 'card destroyed state is correct');
      await card.delete();

      assert.equal(card.isDestroyed, true, 'card destroyed state is correct');
      assert.equal(
        fields.every(i => i.isDestroyed),
        true,
        'fields destroyed state is correct'
      );
      await assert.rejects(service.getCard(card1Id, 'isolated'), /Not Found/);
    });

    test('it invalidates cards that contained the deleted card', async function(assert) {
      let service = this.owner.lookup('service:data');
      let article = await service.getCard(card1Id, 'embedded'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');
      article = await service.getCard(card1Id, 'isolated'); // load the card to be invalidated into the store
      assert.equal(article.getField('author').value.getField('name').value, 'Van Gogh');

      let person = await service.getCard(card2Id, 'isolated');
      await person.delete();

      article = await service.getCard(card1Id, 'embedded');
      assert.equal(article.getField('author').value, undefined);
      article = await service.getCard(card1Id, 'isolated');
      assert.equal(article.getField('author').value, undefined);
    });

    test('throws when you call addField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.addField(nameField), /destroyed card/);
    });

    test('throws when you call getField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.getField('title'), /destroyed card/);
    });

    test('throws when you call getFieldByNonce from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.getFieldByNonce(0), /destroyed card/);
    });

    test('throws when you call save from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.save(), /destroyed card/);
    });

    test('throws when you call load from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.load('embedded'), /destroyed card/);
    });

    test('throws when you call delete from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      await assert.rejects(card.delete(), /destroyed card/);
    });

    test('throws when you call setAdoptedFrom from a deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = await service.getCard(card1Id, 'isolated');
      let card = await service.createCard(card3Id);
      await card.save();
      await card.delete();

      assert.throws(() => card.setAdoptedFrom(parent), /destroyed card/);
    });

    test('throws when you call setAdoptedFrom, where you are adopting from a deleted card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let parent = await service.getCard(card1Id, 'isolated');
      let card = await service.createCard(card3Id);
      await card.save();
      await parent.delete();

      assert.throws(() => card.setAdoptedFrom(parent), /has been destroyed/);
    });

    test('it throws when you call setIsolatedCss on a deleted card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.setIsolatedCss('.card {}'), /destroyed card/);
    });

    test('it throws when you call setEmbeddedCss on a deleted card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      await card.delete();

      assert.throws(() => card.setEmbeddedCss('.card {}'), /destroyed card/);
    });

    test('throws when you set the value from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setValue('update'), /destroyed field/);
    });

    test('throws when you set the label from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setLabel('update'), /destroyed field/);
    });

    test('throws when you set the instructions from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setInstructions('update'), /destroyed field/);
    });

    test('throws when you call remove from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.remove(), /destroyed field/);
    });

    test('throws when you call setNeededWhenEmbedded from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setNeededWhenEmbedded(false), /destroyed field/);
    });

    test('throws when you call setName from deleted Field instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => field.setName(false), /destroyed field/);
    });

    test('throws when you call moveField from deleted Card instance', async function(assert) {
      let service = this.owner.lookup('service:data');
      let card = await service.getCard(card1Id, 'isolated');
      let field = card.getField('title');
      await card.delete();

      assert.throws(() => card.moveField(field, 2), /destroyed card/);
    });
  });
});
