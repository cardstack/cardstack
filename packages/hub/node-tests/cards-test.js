const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const { removeSync, pathExistsSync } = require('fs-extra');
const { readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { cloneDeep, set } = require('lodash');
const { adaptCardToFormat, cardBrowserAssetFields } = require('../indexing/card-utils');

const internalArticleCard = require('./internal-cards/article-card');
const foreignSchema = require('./internal-cards/foreign-schema');
const mismatchedModel = require('./internal-cards/mismatched-model');
const foreignInternalBelongsToRelationship = require('./internal-cards/foreign-internal-model-belongs-to-relationship');
const foreignInternalHasManyRelationship = require('./internal-cards/foreign-internal-model-has-many-relationship');
const foriegnInternalModelIncluded = require('./internal-cards/foreign-internal-model-included');
const userCard = require('./internal-cards/user-card');

const foreignModelType = require('./external-cards/foreign-model-type');
const foreignModelId = require('./external-cards/foreign-model-id');
const user1Card = require('./external-cards/user1-card');
const user2Card = require('./external-cards/user2-card');
const doorsArticleCard = require('./external-cards/article-card');
const genXKittens = require('./external-cards/genx-kittens');
const genZHamsters = require('./external-cards/genz-hamsters');

const cardsDir = join(tmpdir(), 'card_modules');
let env;

function cleanup() {
  removeSync(cardsDir);
}

async function convertToExternalFormat(internalCard) {
  let externalCard = await adaptCardToFormat(await env.lookup('hub:current-schema').getSchema(), env.session, internalCard, 'isolated', env.lookup('hub:searchers'));

  // remove the card metadata to make this as real as possible...
  for (let field of Object.keys(externalCard.data.attributes)) {
    if (cardBrowserAssetFields.includes(field)) { continue; }
    delete externalCard.data.attributes[field];
  }

  return externalCard;
}

function assertCardOnDisk() {
  let browserAssets = [
    'embedded.css',
    'embedded.js',
    'embedded.hbs',
    'isolated.css',
    'isolated.js',
    'isolated.hbs',
  ];

  [
    'card.js',
    'package.json',
  ].concat(browserAssets).map(file => expect(pathExistsSync(join(cardsDir, 'local-hub', 'millenial-puppies', file))).to.equal(true, `${file} exists`));

  let cardOnDisk = require(join(cardsDir, 'local-hub', 'millenial-puppies', 'card.js'));
  delete internalArticleCard.data.meta;
  expect(cardOnDisk.data).to.eql(internalArticleCard.data, 'card on disk is correct');

  let pkgJson = require(join(cardsDir, 'local-hub', 'millenial-puppies', 'package.json'));
  expect(pkgJson).to.eql({
    name: 'millenial-puppies',
    version: '0.0.0',
    peerDependencies: {
      '@glimmer/component': '*'
    }
  }, 'package.json is correct');

  browserAssets.map(file => {
    let [format, type] = file.split('.');
    type = type === 'hbs' ? 'template' : type;
    let contents = readFileSync(join(cardsDir, 'local-hub', 'millenial-puppies', file), 'utf-8');
    let fieldValue = internalArticleCard.data.attributes[`${format}-${type}`].trim();
    expect(contents).to.equal(fieldValue, `file contents are correct for ${file}`);
  });
}

function assertIsolatedCardMetadata(card) {
  let { data } = card;
  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
  expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
  expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(data.attributes['embedded-metadata-field-types']).to.be.undefined; // this one shouldn't leak into the external format
  expect(data.attributes['metadata-field-types']).to.eql({
    title: '@cardstack/core-types::string',
    body: '@cardstack/core-types::string',
    author: '@cardstack/core-types::belongs-to',
    tags: '@cardstack/core-types::has-many',
  });
  expect(data.relationships.tags.data).to.eql([
    { type: 'tags', id: 'millenials' },
    { type: 'tags', id: 'puppies' },
    { type: 'tags', id: 'belly-rubs' },
  ]);
  expect(data.attributes['internal-field']).to.be.undefined;
}

function assertEmbeddedCardMetadata(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
  expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(data.relationships.tags).to.be.undefined;
  expect(data.attributes.body).to.be.undefined;
  expect(data.attributes['internal-field']).to.be.undefined;
  expect(data.attributes['embedded-metadata-field-types']).to.be.undefined; // this one shouldn't leak into the external format
  expect(data.attributes['metadata-field-types']).to.eql({
    title: '@cardstack/core-types::string',
    author: '@cardstack/core-types::belongs-to',
  });

  expect(includedIdentifiers).to.not.include.members([
    'tags/millenials',
    'tags/puppies',
    'tags/belly-rubs',
  ]);
  expect(includedIdentifiers).to.include.members([
    'cards/local-hub::van-gogh',
  ]);
  let relatedCard = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::van-gogh');
  expect(relatedCard.attributes.name).to.equal('Van Gogh');
  expect(relatedCard.attributes.email).to.be.undefined;
}

function assertCardModels(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
  expect(data.relationships.model.data).to.eql({ type: 'local-hub::millenial-puppies', id: 'local-hub::millenial-puppies' });
  expect(includedIdentifiers).to.include.members(['local-hub::millenial-puppies/local-hub::millenial-puppies']);
  expect(includedIdentifiers).to.include.members([
    'cards/local-hub::van-gogh',
    'tags/millenials',
    'tags/puppies',
    'tags/belly-rubs',
  ]);

  let model = included.find(i => `${i.type}/${i.id}` === 'local-hub::millenial-puppies/local-hub::millenial-puppies');
  expect(model.attributes.title).to.equal('The Millenial Puppy');
  expect(model.attributes.body).to.match(/discerning tastes of the millenial puppy/);
  expect(model.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(model.attributes['embedded-metadata-field-types']).to.be.undefined; // this one shouldn't leak into the model
  expect(model.attributes['metadata-field-types']).to.be.undefined; // this one shouldn't leak into the external model
  expect(model.relationships.tags.data).to.eql([
    { type: 'tags', id: 'millenials' },
    { type: 'tags', id: 'puppies' },
    { type: 'tags', id: 'belly-rubs' },
  ]);
  expect(model.attributes['internal-field']).to.equal('this is internal data');

  let relatedCard = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::van-gogh');
  expect(relatedCard.attributes.name).to.equal('Van Gogh');
  expect(relatedCard.attributes.email).to.be.undefined;
  expect(relatedCard.attributes['embedded-metadata-field-types']).to.be.undefined; // this one shouldn't leak into the external format
  expect(relatedCard.attributes['metadata-field-types']).to.eql({
    name: '@cardstack/core-types::string'
  });
}

function assertCardSchema(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

  expect(data.relationships.fields.data).to.eql([
    { type: 'fields', id: 'title' },
    { type: 'fields', id: 'author' },
    { type: 'fields', id: 'body' },
    { type: 'fields', id: 'internal-field' },
    { type: 'computed-fields', id: 'tag-names' },
    { type: 'fields', id: 'tags' },
  ]);
  expect(includedIdentifiers).to.include.members([
    'fields/title',
    'fields/body',
    'fields/author',
    'fields/internal-field',
    'fields/tags',
    'computed-fields/tag-names',
    'content-types/tags',
    'constraints/title-not-null'
  ]);

  // Card does not include the primary model content type schema--as that is derived by the hub,
  // and there is really nothing that explicitly references it, so it wouldn't really make sense
  // to include anyways...
  expect(includedIdentifiers).to.not.include.members([
    'content-types/local-hub::millenial-puppies'
  ]);
}

describe('hub/card-services', function () {
  let cardServices;

  afterEach(async function () {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
    cleanup();
  });

  describe("card validation", function () {
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'stub-card-project')
        .withAttributes({
          sourceType: 'stub-card-project',
          params: {
            cardSearchResults: [
              internalArticleCard,
              foreignSchema,
              mismatchedModel,
              foreignInternalBelongsToRelationship,
              foreignInternalHasManyRelationship,
              foriegnInternalModelIncluded,
              userCard,
            ]
          }
        });
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
    });

    it("does not allow card with foreign field to be loaded", async function () {
      let error;
      try {
        await cardServices.get(env.session, foreignSchema.data.id, 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(400);
      expect(error.message).to.match(/foreign field/);
      expect(error.source).to.eql({ pointer: '/data/relationships/fields/data/0' });
    });

    it("does not allow a card with a mismatched model to be loaded", async function () {
      let error;
      try {
        await cardServices.get(env.session, mismatchedModel.data.id, 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model content-type that does not match its id/);
      expect(error.source).to.eql({ pointer: '/data/id' });
    });

    it("does not allow a card to have a belongs-to relationship to a foreign internal model", async function () {
      let error;
      try {
        await cardServices.get(env.session, foreignInternalBelongsToRelationship.data.id, 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(400);
      expect(error.message).to.match(/has a relationship to a foreign internal model/);
      expect(error.source).to.eql({ pointer: `/data/relationships/local-hub::foreign-internal-belongs-to-relationship::related-thing/data` });
    });

    it("does not allow a card to have a has-many relationship to a foreign internal model", async function () {
      let error;
      try {
        await cardServices.get(env.session, foreignInternalHasManyRelationship.data.id, 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(400);
      expect(error.message).to.match(/has a relationship to a foreign internal model/);
      expect(error.source).to.eql({ pointer: `/data/relationships/local-hub::foreign-internal-has-many-relationship::related-things/data/0` });
    });

    it("does not allow a card to have included that contains foreign card internal models", async function () {
      let error;
      try {
        await cardServices.get(env.session, foriegnInternalModelIncluded.data.id, 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(400);
      expect(error.message).to.match(/contains included foreign internal models/);
      expect(error.source).to.eql({ pointer: `/included/0` });
    });
  });

  describe('writing cards', function () {
    let externalArticleCard, externalUserCard;
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
      externalArticleCard = await convertToExternalFormat(internalArticleCard);
      externalUserCard = await convertToExternalFormat(userCard);
      await cardServices.create(env.session, externalUserCard);
    });

    it('can add a new card', async function () {
      let card = await cardServices.create(env.session, externalArticleCard);

      assertCardOnDisk();
      assertIsolatedCardMetadata(card);
      assertCardModels(card);
      assertCardSchema(card);

      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      assertIsolatedCardMetadata(article);
    });

    it("does not allow missing card model when creating card", async function () {
      let missingModel = cloneDeep(externalArticleCard);
      delete missingModel.data.relationships.model;
      missingModel.included = missingModel.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::millenial-puppies/local-hub::millenial-puppies');

      let error;
      try {
        await cardServices.create(env.session, missingModel);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/is missing its card model/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be created with a model whose type does not match the card id", async function () {
      let error;
      try {
        await cardServices.create(env.session, foreignModelType);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model does not match the card id/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be created with a model specified but missing in the included resource", async function () {
      let error;
      try {
        let badArticle = cloneDeep(externalArticleCard);
        badArticle.included = badArticle.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::millenial-puppies/local-hub::millenial-puppies');
        await cardServices.create(env.session, badArticle);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/The specified card model .* is missing/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be created with a model whose id does not match the card id", async function () {
      let error;
      try {
        await cardServices.create(env.session, foreignModelId);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model does not match the card id/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("can add a field to a card's schema", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.fields.data.push({ type: 'fields', id: 'editor' });
      card.included.push({
        type: 'fields',
        id: 'editor',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        }
      });

      card = await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');

      card = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');
    });

    it('can add a new related card field', async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.fields.data.push({ type: 'fields', id: 'editor' });
      card.included.push({
        type: 'fields',
        id: 'editor',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::belongs-to'
        }
      });
      let internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      set(internalModel, 'relationships.editor.data', { type: 'cards', id: externalUserCard.data.id });

      card = await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      let editor = card.included.find(i => i.id === externalUserCard.data.id);

      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');
      expect(data.relationships.editor.data).to.eql({ type: 'cards', id: externalUserCard.data.id });
      expect(internalModel.relationships.editor.data).to.eql({ type: 'cards', id: externalUserCard.data.id });
      expect(editor.attributes.name).to.equal('Van Gogh');
      expect(editor.attributes.email).to.be.undefined;

      card = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      editor = card.included.find(i => i.id === externalUserCard.data.id);
      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');
      expect(data.relationships.editor.data).to.eql({ type: 'cards', id: externalUserCard.data.id });
      expect(internalModel.relationships.editor.data).to.eql({ type: 'cards', id: externalUserCard.data.id });
      expect(editor.attributes.name).to.equal('Van Gogh');
      expect(editor.attributes.email).to.be.undefined;
    });


    it("can remove a field from the card's schema", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.fields.data = card.data.relationships.fields.data.filter(i => i.id !== 'body');
      card.included = card.included.filter(i => i.id !== 'body');

      card = await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(card.data.attributes.body).to.be.undefined;
      expect(includedIdentifiers).to.not.include('fields/body');
      expect(fieldRelationships).to.not.include('fields/body');

      card = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(card.data.attributes.body).to.be.undefined;
      expect(includedIdentifiers).to.not.include('fields/body');
      expect(fieldRelationships).to.not.include('fields/body');
    });

    it("can update a card's internal model", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      let internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      internalModel.attributes.body = 'updated body';

      card = await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');

      assertCardSchema(card);
      expect(card.data.attributes.body).to.equal('updated body');
      expect(internalModel.attributes.body).to.equal('updated body');

      card = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      expect(card.data.attributes.body).to.equal('updated body');
      expect(internalModel.attributes.body).to.equal('updated body');
    });

    it("does not allow missing card model when updating card", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      delete card.data.relationships.model;
      card.included = card.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::millenial-puppies/local-hub::millenial-puppies');

      let error;
      try {
        await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/is missing its card model/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("can update a card's schema and a card model at the same time", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      let internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      internalModel.attributes.editor = 'Hassan';
      card.data.relationships.fields.data.push({ type: 'fields', id: 'editor' });
      card.included.push({
        type: 'fields',
        id: 'editor',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        }
      });

      card = await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');
      expect(card.data.attributes.editor).to.equal('Hassan');
      expect(internalModel.attributes.editor).to.equal('Hassan');

      card = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(includedIdentifiers).to.include('fields/editor');
      expect(fieldRelationships).to.include('fields/editor');
      expect(card.data.attributes.editor).to.equal('Hassan');
      expect(internalModel.attributes.editor).to.equal('Hassan');
    });

    it('can delete a card', async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      let { data: { meta: { version } } } = card;
      await cardServices.delete(env.session, 'local-hub::millenial-puppies', version);

      let error;
      try {
        await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);
    });

    it("does not allow a card to be updated with a model whose type does not match the card id", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.model.data.type = 'local-hub::bad';
      let internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      internalModel.type = 'local-hub::bad';
      let error;
      try {
        await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model does not match the card id/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be updated with a model whose id does not match the card id", async function () {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.model.data.id = 'local-hub::bad';
      let internalModel = card.included.find(i => i.type = 'local-hub::millenial-puppies');
      internalModel.id = 'local-hub::bad';
      let error;
      try {
        await cardServices.update(env.session, 'local-hub::millenial-puppies', card);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model does not match the card id/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });
  });

  describe('get card', function () {
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
      let externalArticleCard = await convertToExternalFormat(internalArticleCard);
      let externalUserCard = await convertToExternalFormat(userCard);
      await cardServices.create(env.session, externalUserCard);
      await cardServices.create(env.session, externalArticleCard);
    });

    it("has a base-card", async function() {
      let { data, included } = await cardServices.get(env.session, 'local-hub::@cardstack/base-card', 'isolated');
      expect(data).to.be.ok;
      let model = included.find(i => `${i.type}/${i.id}` === 'local-hub::@cardstack/base-card/local-hub::@cardstack/base-card');
      expect(model).to.be.ok;
    });

    it("has card metadata for isolated format", async function () {
      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      assertIsolatedCardMetadata(article);
    });

    it("has card metadata for embedded format", async function () {
      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'embedded');
      assertEmbeddedCardMetadata(article);
    });

    it("has card models", async function () {
      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      assertCardModels(article);
    });

    it("has card schema", async function () {
      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      assertCardSchema(article);
    });

    it("has card browser assets", async function () {
      let article = await cardServices.get(env.session, 'local-hub::millenial-puppies', 'isolated');
      let { data } = article;

      // Note that the browser assets not defined in the card will inherit from the adopted card, or ultimately the genesis card
      expect(data.attributes['isolated-template']).to.match(/<div>\{\{this\.body\}\}<\/div>/);
      expect(data.attributes['isolated-js']).to.match(/ArticleIsolatedComponent/);
      expect(data.attributes['isolated-css']).to.match(/\.article-card-isolated \{\}/);
      expect(data.attributes['embedded-template']).to.match(/<h3>\{\{this\.title\}\}<\/h3>/);
      expect(data.attributes['embedded-js']).to.match(/ArticleEmbeddedComponent/);
      expect(data.attributes['embedded-css']).to.match(/\.article-card-embedded \{\}/);
    });
  });

  describe('card nesting', function () {
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
    });

    it(`can fashion relationship to card that didn't originally exist at the time the card was created`, async function () {
      let user1 = await cardServices.create(env.session, user1Card);
      let model = user1.included.find(({ type, id }) => `${type}/${id}` === `${user1.data.id}/${user1.data.id}`);
      expect(user1.data.relationships.friends.data).to.eql([]);
      expect(model.relationships.friends.data).to.eql([]);

      await cardServices.create(env.session, user2Card);
      user1 = await cardServices.get(env.session, user1Card.data.id, 'isolated');
      model = user1.included.find(({ type, id }) => `${type}/${id}` === `${user1Card.data.id}/${user1Card.data.id}`);
      expect(user1.data.relationships.friends.data).to.eql([{ type: 'cards', id: user2Card.data.id }]);
      expect(model.relationships.friends.data).to.eql([{ type: 'cards', id: user2Card.data.id }]);
    });

    it(`can include embedded cards that are embedded relationships of a directly related embedded card`, async function () {
      let user1 = await cardServices.create(env.session, user1Card);
      let user2 = await cardServices.create(env.session, user2Card);
      let article = await cardServices.create(env.session, doorsArticleCard);

      let includedRefs = article.included.map(({ type, id }) => `${type}/${id}`);
      expect(includedRefs).to.include(`cards/${user1.data.id}`);
      expect(includedRefs).to.include(`cards/${user2.data.id}`);

      let user1Resource = article.included.find(({ type, id }) => `${type}/${id}` === `cards/${user1.data.id}`);
      let user2Resource = article.included.find(({ type, id }) => `${type}/${id}` === `cards/${user2.data.id}`);

      expect(user1Resource.attributes.name).to.equal('Van Gogh');
      expect(user1Resource.attributes.email).to.be.undefined;
      expect(user2Resource.attributes.name).to.equal('Hassan');
      expect(user2Resource.attributes.email).to.be.undefined;
    });

    it("can invalidate a card that has a relationship to an updated card", async function () {
      await cardServices.create(env.session, user1Card);
      let user2 = await cardServices.create(env.session, user2Card);
      await cardServices.create(env.session, doorsArticleCard);

      let article = await cardServices.get(env.session, doorsArticleCard.data.id, 'isolated');
      let embeddedUser2 = article.included.find(i => `${i.type}/${i.id}` === `cards/${user2Card.data.id}`);
      expect(embeddedUser2.attributes.name).to.equal('Hassan');

      let internalModel = user2.included.find(i => i.type = 'local-hub::hassan');
      internalModel.attributes.name = 'Babikir';
      user2 = await cardServices.update(env.session, user2Card.data.id, user2);

      expect(user2.data.attributes.name).to.equal('Babikir');
      article = await cardServices.get(env.session, doorsArticleCard.data.id, 'isolated');
      embeddedUser2 = article.included.find(i => `${i.type}/${i.id}` === `cards/${user2Card.data.id}`);
      expect(embeddedUser2.attributes.name).to.equal('Babikir');
    });
  });

  describe('card read authorization', function () {
    let allowedUser, restrictedUser;

    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      // Grants are set against the model content type, as that
      // is where the meta fields actually live
      factory.addResource('grants')
        .withRelated('who', [{ type: 'groups', id: 'everyone' }])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::millenial-puppies' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'local-hub::millenial-puppies::title' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });

      factory.addResource('grants')
        .withRelated('who', [{ type: 'test-users', id: 'allowed-user' }])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::millenial-puppies' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'local-hub::millenial-puppies::author' },
          { type: 'fields', id: 'local-hub::millenial-puppies::body' },
          { type: 'fields', id: 'local-hub::millenial-puppies::tag-names' },
          { type: 'fields', id: 'local-hub::millenial-puppies::tags' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });

      factory.addResource('grants')
        .withRelated('who', [{ type: 'test-users', id: 'allowed-user' }])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::van-gogh' }
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });

      factory.addResource('test-users', 'allowed-user');
      factory.addResource('test-users', 'restricted-user');

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
      restrictedUser = env.lookup('hub:sessions').create('test-users', 'restricted-user');
      allowedUser = env.lookup('hub:sessions').create('test-users', 'allowed-user');
      let externalArticleCard = await convertToExternalFormat(internalArticleCard);
      let externalUserCard = await convertToExternalFormat(userCard);
      await cardServices.create(env.session, externalUserCard);
      await cardServices.create(env.session, externalArticleCard);
    });

    describe('get()', function () {
      it('does not return card whose model content type the session does not have read authorization', async function () {
        let error;
        try {
          await cardServices.get(restrictedUser, 'local-hub::van-gogh', 'isolated');
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);
      });

      it('does return card whose model content type the session has read authorization', async function () {
        let { data } = await cardServices.get(allowedUser, 'local-hub::van-gogh', 'isolated');

        expect(data.id).to.equal('local-hub::van-gogh');
        expect(data.type).to.equal('cards');
      });

      it('does not return card metadata that the session does not have read authorization', async function () {
        let { data, included } = await cardServices.get(restrictedUser, 'local-hub::millenial-puppies', 'isolated');

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.relationships.author).to.be.undefined;
        expect(data.relationships.tags).to.be.undefined;
        expect(data.attributes.body).to.be.undefined;
        expect(data.attributes['internal-field']).to.be.undefined;

        let model = included.find(i => `${i.type}/${i.id}` === 'local-hub::millenial-puppies/local-hub::millenial-puppies');
        expect(model.attributes.title).to.equal('The Millenial Puppy');
        expect(model.relationships.author).to.be.undefined;
        expect(model.relationships.tags).to.be.undefined;
        expect(model.attributes.body).to.be.undefined;
        expect(model.attributes['internal-field']).to.be.undefined;
      });

      it('does return card metadata that the session has read authorization', async function () {
        let { data, included } = await cardServices.get(allowedUser, 'local-hub::millenial-puppies', 'isolated');

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
        expect(data.relationships.tags.data).to.eql([
          { type: 'tags', id: 'millenials' },
          { type: 'tags', id: 'puppies' },
          { type: 'tags', id: 'belly-rubs' },
        ]);
        expect(data.attributes['internal-field']).to.be.undefined;
        expect(data.attributes['metadata-field-types']).to.eql({
          title: '@cardstack/core-types::string',
          body: '@cardstack/core-types::string',
          author: '@cardstack/core-types::belongs-to',
          tags: '@cardstack/core-types::has-many',
        });

        let model = included.find(i => `${i.type}/${i.id}` === 'local-hub::millenial-puppies/local-hub::millenial-puppies');
        expect(model.attributes.title).to.equal('The Millenial Puppy');
        expect(model.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(model.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
        expect(model.relationships.tags.data).to.eql([
          { type: 'tags', id: 'millenials' },
          { type: 'tags', id: 'puppies' },
          { type: 'tags', id: 'belly-rubs' },
        ]);
        expect(model.attributes['internal-field']).to.be.undefined;

        let embedded = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::van-gogh');
        expect(embedded.attributes.name).to.equal('Van Gogh');
        expect(embedded.attributes.email).to.be.undefined;
        expect(embedded.attributes['metadata-field-types']).to.eql({
          name: '@cardstack/core-types::string',
        });
      });

      it('does not contain included resource for card metadata relationship that the session does not have read authorization', async function () {
        let { included } = await cardServices.get(restrictedUser, 'local-hub::millenial-puppies', 'isolated');

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.not.include.members([
          'cards/local-hub::van-gogh',
        ]);
      });

      it('does contain included resource for card metadata relationship that the session does has read authorization', async function () {
        let { included } = await cardServices.get(allowedUser, 'local-hub::millenial-puppies', 'isolated');

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.include.members([
          'cards/local-hub::van-gogh',
        ]);

        expect(includedIdentifiers).to.not.include.members([
          'local-hub::van-gogh/local-hub::van-gogh',
          // intentionally asserting both the namespaced schema elements and non-namespaced schema elements dont exist
          'fields/local-hub::van-gogh::name',
          'fields/local-hub::van-gogh::email',
          'fields/name',
          'fields/email',
        ]);
        let card = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::van-gogh');
        expect(card.attributes.name).to.equal('Van Gogh');
        expect(card.attributes.email).to.be.undefined;
      });
    });

    // Using a custom searcher for these tests is problematic. Unskip this after we have searching for real.
    describe.skip('TODO search()', function () {
      it.skip('does not return card whose model content type the session does not have read authorization', async function () {
        // TODO implement this after we have pgsearch support for searching for cards,
        // otherwise we'll just be testing the test, as custom searchers (i.e. our stub-card-project's searcher)
        // are each responsible enforcing grants on the their results
      });

      it('does not return card metadata that the session does not have read authorization', async function () {
        let { data: [card], included: [model] } = await cardServices.search(restrictedUser, 'isolated', {
          filter: {
            id: { exact: 'local-hub::millenial-puppies' },
            type: { exact: 'cards' }
          }
        });
        expect(card.attributes.title).to.equal('The Millenial Puppy');
        expect(card.relationships.author).to.be.undefined;
        expect(card.relationships.tags).to.be.undefined;
        expect(card.attributes.body).to.be.undefined;
        expect(card.attributes['internal-field']).to.be.undefined;

        expect(model.attributes.title).to.equal('The Millenial Puppy');
        expect(model.relationships.author).to.be.undefined;
        expect(model.relationships.tags).to.be.undefined;
        expect(model.attributes.body).to.be.undefined;
        expect(model.attributes['internal-field']).to.be.undefined;
      });

      it('does return card metadata that the session has read authorization', async function () {
        let { data: [card], included: [model] } = await cardServices.search(allowedUser, 'isolated', {
          filter: {
            id: { exact: 'local-hub::millenial-puppies' },
            type: { exact: 'cards' }
          }
        });
        expect(card.attributes.title).to.equal('The Millenial Puppy');
        expect(card.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(card.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
        expect(card.relationships.tags.data).to.eql([
          { type: 'tags', id: 'millenials' },
          { type: 'tags', id: 'puppies' },
          { type: 'tags', id: 'belly-rubs' },
        ]);
        expect(card.attributes['internal-field']).to.be.undefined;

        expect(model.attributes.title).to.equal('The Millenial Puppy');
        expect(model.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(model.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
        expect(model.relationships.tags.data).to.eql([
          { type: 'tags', id: 'millenials' },
          { type: 'tags', id: 'puppies' },
          { type: 'tags', id: 'belly-rubs' },
        ]);
        expect(model.attributes['internal-field']).to.be.undefined;
      });

      it('does not contain included resource for card metadata relationship that the session does not have read authorization', async function () {
        let { included } = await cardServices.search(restrictedUser, 'isolated', {
          filter: {
            id: { exact: 'local-hub::millenial-puppies' },
            type: { exact: 'cards' }
          }
        });

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.not.include.members([
          'cards/local-hub::van-gogh',
        ]);
      });

      it('does contain included resource for card metadata relationship that the session does has read authorization', async function () {
        let { included } = await cardServices.search(allowedUser, 'isolated', {
          filter: {
            id: { exact: 'local-hub::millenial-puppies' },
            type: { exact: 'cards' }
          }
        });

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.include.members([
          'cards/local-hub::van-gogh',
        ]);

        expect(includedIdentifiers).to.not.include.members([
          'local-hub::van-gogh/local-hub::van-gogh',
          // intentionally asserting both the namespaced schema elements and non-namespaced schema elements dont exist
          'fields/local-hub::van-gogh::name',
          'fields/local-hub::van-gogh::email',
          'fields/name',
          'fields/email',
        ]);
        let card = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::van-gogh');
        expect(card.attributes.name).to.equal('Van Gogh');
        expect(card.attributes.email).to.be.undefined;
      });
    });
  });

  describe.skip('search for card', function () {
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();

      factory.addResource('data-sources', 'stub-card-project')
        .withAttributes({
          sourceType: 'stub-card-project',
          params: {
            cardSearchResults: [
              internalArticleCard,
              userCard,
            ]
          }
        });

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
    });

    it.skip("can search for a card by an adopted field", async function () {
    });

    // Hassan: I'm skeptical we want to be able to return search results in the isolated format...
    it("will load a card implicitly when a searcher's search() hook returns a card document in isolated format", async function () {
      let { data: [article] } = await cardServices.search(env.session, 'isolated', {
        filter: {
          type: { exact: 'cards' }
        }
      });

      assertIsolatedCardMetadata({ data: article });
      assertCardOnDisk();
    });

    // TODO get rid of the custom searcher and use pgsearch (custom search is totally just temporary until we have the real thing)
    it("will load a card implicitly when a searcher's search() hook returns a card document in embedded format", async function () {
      let { data: [article] } = await cardServices.search(env.session, 'embedded', {
        filter: {
          type: { exact: 'cards' }
        }
      });

      expect(article.attributes.title).to.equal('The Millenial Puppy');
      expect(article.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::van-gogh' });
      expect(article.attributes.body).to.be.undefined;
      expect(article.relationships.tags).to.be.undefined;
      expect(article.attributes['internal-field']).to.be.undefined;

      assertCardOnDisk();
    });
  });

  describe('card adoption', function () {
    let externalArticleCard, externalUserCard;
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
      externalArticleCard = await convertToExternalFormat(internalArticleCard);
      externalUserCard = await convertToExternalFormat(userCard);
      await cardServices.create(env.session, externalArticleCard);
      await cardServices.create(env.session, externalUserCard);
    });

    it("can get a card that uses adoption in an isolated format", async function () {
      let adoptedCreateResponse = await cardServices.create(env.session, genXKittens);
      let adopted = await cardServices.get(env.session, genXKittens.data.id, 'isolated');
      delete adoptedCreateResponse.data.meta.source;
      delete adopted.data.meta.source;

      // clean up empty relationship default values to make it easier to deep equals
      for (let resource of adopted.included) {
        if (resource.type !== 'fields') { continue; }
        delete resource.relationships;
      }

      expect(adoptedCreateResponse).to.eql(adopted, 'the card returned from the create() is the same as the card returned from get()');
      expect(adopted.data.relationships['adopted-from'].data).to.eql({
        type: 'cards',
        id: externalArticleCard.data.id
      });

      let fieldSpecs = adopted.data.relationships.fields.data.map(f => `${f.type}/${f.id}`);
      expect(fieldSpecs).to.include("fields/yarn");

      // the adopted fields are governed by the card that defines the field's schema, and should not
      // be present in the fields relationship of the card that is doing the adoption
      expect(fieldSpecs).to.not.include("fields/title");
      expect(fieldSpecs).to.not.include("fields/author");
      expect(fieldSpecs).to.not.include("fields/body");

      let includedSpecs = adopted.included.map(i => `${i.type}/${i.id}`);

      expect(includedSpecs.length).to.equal(3);
      expect(includedSpecs).to.include(`${genXKittens.data.id}/${genXKittens.data.id}`);
      expect(includedSpecs).to.include(`cards/${externalUserCard.data.id}`);
      expect(includedSpecs).to.include("fields/yarn");
      expect(includedSpecs).to.not.include("fields/title");
      expect(includedSpecs).to.not.include("fields/author");
      expect(includedSpecs).to.not.include("fields/body");

      let fieldMeta = adopted.data.attributes['metadata-field-types'];

      expect(fieldMeta.yarn).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.title).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.author).to.equal("@cardstack/core-types::belongs-to");
      expect(fieldMeta.body).to.equal("@cardstack/core-types::string");

      expect(adopted.data.attributes.yarn).to.equal("wool");
      expect(adopted.data.attributes.title).to.equal("GenX Kittens");
      expect(adopted.data.attributes.body).to.equal("Here is the body");

      expect(adopted.data.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });

      let model = adopted.included.find(i => i.type === genXKittens.data.id && i.id == genXKittens.data.id);

      expect(model.attributes.yarn).to.equal("wool");
      expect(model.attributes.title).to.equal("GenX Kittens");
      expect(model.attributes.body).to.equal("Here is the body");

      expect(model.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });
    });

    it("can get a card that uses adoption in an embedded format", async function () {
      await cardServices.create(env.session, genXKittens);
      let adopted = await cardServices.get(env.session, genXKittens.data.id, 'embedded');
      expect(adopted.data.relationships['adopted-from'].data).to.eql({
        type: 'cards',
        id: externalArticleCard.data.id
      });

      let fieldSpecs = adopted.data.relationships.fields.data.map(f => `${f.type}/${f.id}`);
      expect(fieldSpecs).to.include("fields/yarn");

      // the adopted fields are governed by the card that defines the field's schema, and should not
      // be present in the fields relationship of the card that is doing the adoption
      expect(fieldSpecs).to.not.include("fields/title");
      expect(fieldSpecs).to.not.include("fields/author");
      expect(fieldSpecs).to.not.include("fields/body");

      let includedSpecs = adopted.included.map(i => `${i.type}/${i.id}`);
      expect(includedSpecs.length).to.equal(1);
      expect(includedSpecs).to.include(`cards/${externalUserCard.data.id}`);

      let fieldMeta = adopted.data.attributes['metadata-field-types'];

      expect(fieldMeta.yarn).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.title).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.author).to.equal("@cardstack/core-types::belongs-to");
      expect(fieldMeta.body).to.be.undefined;

      expect(adopted.data.attributes.yarn).to.equal("wool");
      expect(adopted.data.attributes.title).to.equal("GenX Kittens");
      expect(adopted.data.attributes.body).to.be.undefined;

      expect(adopted.data.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });
    });

    it.skip("can adopt internal fields", async function () {
      // it's fine to just add this assertion into the existing isolated and embedded tests for adopted cards
    });

    it.skip("can adopt computed-fields", async function () {
      // it's fine to just add this assertion into the existing isolated and embedded tests for adopted cards
    });

    it("can get an isolated card that uses multiple levels of adoption", async function () {
      await cardServices.create(env.session, genXKittens);
      let adoptedCreateResponse = await cardServices.create(env.session, genZHamsters);
      let adopted = await cardServices.get(env.session, genZHamsters.data.id, 'isolated');
      delete adoptedCreateResponse.data.meta.source;
      delete adopted.data.meta.source;

      // clean up empty relationship default values to make it easier to deep equals
      for (let resource of adopted.included) {
        if (resource.type !== 'fields') { continue; }
        delete resource.relationships;
      }

      expect(adoptedCreateResponse).to.eql(adopted, 'the card returned from the create() is the same as the card returned from get()');
      expect(adopted.data.relationships['adopted-from'].data).to.eql({
        type: 'cards',
        id: genXKittens.data.id
      });

      let fieldSpecs = adopted.data.relationships.fields.data.map(f => `${f.type}/${f.id}`);
      expect(fieldSpecs).to.include("fields/cuteness");
      expect(fieldSpecs).to.not.include("fields/title");
      expect(fieldSpecs).to.not.include("fields/author");
      expect(fieldSpecs).to.not.include("fields/body");
      expect(fieldSpecs).to.not.include("fields/yarn");

      let includedSpecs = adopted.included.map(i => `${i.type}/${i.id}`);

      expect(includedSpecs.length).to.equal(3);
      expect(includedSpecs).to.include(`${genZHamsters.data.id}/${genZHamsters.data.id}`);
      expect(includedSpecs).to.include(`cards/${externalUserCard.data.id}`);
      expect(includedSpecs).to.include("fields/cuteness");
      expect(includedSpecs).to.not.include("fields/title");
      expect(includedSpecs).to.not.include("fields/author");
      expect(includedSpecs).to.not.include("fields/body");
      expect(includedSpecs).to.not.include("fields/yarn");

      let fieldMeta = adopted.data.attributes['metadata-field-types'];

      expect(fieldMeta.cuteness).to.equal("@cardstack/core-types::integer");
      expect(fieldMeta.yarn).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.title).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.author).to.equal("@cardstack/core-types::belongs-to");
      expect(fieldMeta.body).to.equal("@cardstack/core-types::string");

      expect(adopted.data.attributes.yarn).to.equal("cotton");
      expect(adopted.data.attributes.title).to.equal("GenZ Hamsters");
      expect(adopted.data.attributes.body).to.equal("I am a body");
      expect(adopted.data.attributes.cuteness).to.equal(10);

      expect(adopted.data.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });

      let model = adopted.included.find(i => i.type === genZHamsters.data.id && i.id == genZHamsters.data.id);

      expect(model.attributes.yarn).to.equal("cotton");
      expect(model.attributes.title).to.equal("GenZ Hamsters");
      expect(model.attributes.body).to.equal("I am a body");
      expect(model.attributes.cuteness).to.equal(10);

      expect(model.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });

      expect(adopted.data.attributes['isolated-template']).to.match(/<div>{{this.body}}<\/div>/);
      expect(adopted.data.attributes['isolated-js']).to.match(/export default class ArticleIsolatedComponent/);
      expect(adopted.data.attributes['isolated-css']).to.match(/\.article-card-isolated {}/);
      expect(adopted.data.attributes['embedded-template']).to.match(/<h3>{{this.title}}<\/h3>/);
      expect(adopted.data.attributes['embedded-js']).to.match(/export default class ArticleEmbeddedComponent/);
      expect(adopted.data.attributes['embedded-css']).to.match(/\.article-card-embedded {}/);
    });

    it("can get an embedded card that uses multiple levels of adoption", async function () {
      // this is where a card adopts from a card, that in turn adopts from another card
      await cardServices.create(env.session, genXKittens);
      let adoptedCreateResponse = await cardServices.create(env.session, genZHamsters);
      let adopted = await cardServices.get(env.session, genZHamsters.data.id, 'embedded');
      delete adoptedCreateResponse.data.meta.source;
      delete adopted.data.meta.source;

      // clean up empty relationship default values to make it easier to deep equals
      for (let resource of adopted.included) {
        if (resource.type !== 'fields') { continue; }
        delete resource.relationships;
      }

      expect(adoptedCreateResponse).not.to.eql(adopted, 'the card returned from the create() is the same as the card returned from get()');
      expect(adopted.data.relationships['adopted-from'].data).to.eql({
        type: 'cards',
        id: genXKittens.data.id
      });

      let fieldSpecs = adopted.data.relationships.fields.data.map(f => `${f.type}/${f.id}`);
      expect(fieldSpecs).to.include("fields/cuteness");
      expect(fieldSpecs).to.not.include("fields/title");
      expect(fieldSpecs).to.not.include("fields/author");
      expect(fieldSpecs).to.not.include("fields/body");
      expect(fieldSpecs).to.not.include("fields/yarn");

      let includedSpecs = adopted.included.map(i => `${i.type}/${i.id}`);

      expect(includedSpecs.length).to.equal(1);
      expect(includedSpecs).not.to.include(`${genZHamsters.data.id}/${genZHamsters.data.id}`);
      expect(includedSpecs).to.include(`cards/${externalUserCard.data.id}`);
      expect(includedSpecs).not.to.include("fields/cuteness");
      expect(includedSpecs).not.to.include("fields/title");
      expect(includedSpecs).not.to.include("fields/author");
      expect(includedSpecs).not.to.include("fields/body");
      expect(includedSpecs).not.to.include("fields/yarn");

      let fieldMeta = adopted.data.attributes['metadata-field-types'];

      expect(fieldMeta.cuteness).to.equal("@cardstack/core-types::integer");
      expect(fieldMeta.yarn).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.title).to.equal("@cardstack/core-types::string");
      expect(fieldMeta.author).to.equal("@cardstack/core-types::belongs-to");

      expect(adopted.data.attributes.yarn).to.equal("cotton");
      expect(adopted.data.attributes.title).to.equal("GenZ Hamsters");
      expect(adopted.data.attributes.cuteness).to.equal(10);

      expect(adopted.data.relationships.author.data).to.eql({
        type: 'cards',
        id: externalUserCard.data.id
      });

      expect(adopted.data.attributes['isolated-template']).to.match(/<div>{{this.body}}<\/div>/);
      expect(adopted.data.attributes['isolated-js']).to.match(/export default class ArticleIsolatedComponent/);
      expect(adopted.data.attributes['isolated-css']).to.match(/\.article-card-isolated {}/);
      expect(adopted.data.attributes['embedded-template']).to.match(/<h3>{{this.title}}<\/h3>/);
      expect(adopted.data.attributes['embedded-js']).to.match(/export default class ArticleEmbeddedComponent/);
      expect(adopted.data.attributes['embedded-css']).to.match(/\.article-card-embedded {}/);
    });

    it.skip("can override adopted browser assets", async function () {
      // how we handle browser assets is different than how we handle fields, in that browser assets
      // (islated-js, isolated-template, isolated-css, embedded-js, etc) follows normal inheritance,
      // where a card is allowed to override a browser asset.
    });

    it.skip("throws an error if you try to create a card that defines a field that as the same name as an adopted field", async function() {
    });

    it.skip("throws an error if you try to update a card to have a field that as the same name as an adopted field", async function() {
    });

    it.skip("can get a card that has a belongs-to relationship to a card which uses adoption", async function () {
    });

    it.skip("can get a card that has a has-many relationship to cards which use adoption", async function () {
    });

    it.skip("can enforce read authorization on an adopted field when getting a card", async function () {
      // Probably want to move to the read-auth tests
    });
  });
});

