const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const { removeSync, pathExistsSync } = require('fs-extra');
const { readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { cloneDeep } = require('lodash');
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

const cardsDir = join(tmpdir(), 'card_modules');

function cleanup() {
  removeSync(cardsDir);
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
  ].concat(browserAssets).map(file => expect(pathExistsSync(join(cardsDir, 'local-hub', 'article-card', file))).to.equal(true, `${file} exists`));

  let cardOnDisk = require(join(cardsDir, 'local-hub', 'article-card', 'card.js'));
  delete internalArticleCard.data.meta;
  expect(cardOnDisk.data).to.eql(internalArticleCard.data, 'card on disk is correct');

  let pkgJson = require(join(cardsDir, 'local-hub', 'article-card', 'package.json'));
  expect(pkgJson).to.eql({
    name: 'article-card',
    version: '0.0.0',
    peerDependencies: {
      '@glimmer/component': '*'
    }
  }, 'package.json is correct');

  browserAssets.map(file => {
    let [ format, type ] = file.split('.');
    type = type === 'hbs' ? 'template' : type;
    let contents = readFileSync(join(cardsDir, 'local-hub', 'article-card', file), 'utf-8');
    let fieldValue = internalArticleCard.data.attributes[`${format}-${type}`].trim();
    expect(contents).to.equal(fieldValue, `file contents are correct for ${file}`);
  });
}

function assertIsolatedCardMetadata(card) {
  let { data } = card;
  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
  expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh' });
  expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(data.relationships.tags.data).to.eql([
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
  ]);
  expect(data.attributes['internal-field']).to.be.undefined;
}

function assertEmbeddedCardMetadata(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

  expect(data.attributes.title).to.equal('The Millenial Puppy');
  expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh' });
  expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(data.relationships.tags).to.be.undefined;
  expect(data.attributes.body).to.be.undefined;
  expect(data.attributes['internal-field']).to.be.undefined;

  expect(includedIdentifiers).to.not.include.members([
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::millenials',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::puppies',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::belly-rubs',
  ]);
  expect(includedIdentifiers).to.include.members([
    'cards/local-hub::user-card::van-gogh',
  ]);
  let relatedCard = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
  expect(relatedCard.attributes.name).to.equal('Van Gogh');
  expect(relatedCard.attributes.email).to.be.undefined;
}

function assertCardModels(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
  expect(data.relationships.model.data).to.eql({ type: 'local-hub::article-card::millenial-puppies', id: 'local-hub::article-card::millenial-puppies' });
  expect(includedIdentifiers).to.include.members(['local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies']);
  expect(includedIdentifiers).to.include.members([
    'cards/local-hub::user-card::van-gogh',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::millenials',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::puppies',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::belly-rubs',
  ]);

  let model = included.find(i => `${i.type}/${i.id}` === 'local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies');
  expect(model.attributes.title).to.equal('The Millenial Puppy');
  expect(model.attributes.body).to.match(/discerning tastes of the millenial puppy/);
 expect(model.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
  expect(model.relationships.tags.data).to.eql([
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
    { type: 'local-hub::article-card::millenial-puppies::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
  ]);
  expect(model.attributes['internal-field']).to.equal('this is internal data');

  let relatedCard = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
  expect(relatedCard.attributes.name).to.equal('Van Gogh');
  expect(relatedCard.attributes.email).to.be.undefined;
}

function assertCardSchema(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

  expect(data.relationships.fields.data).to.eql([
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::title' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::author' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::body' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::internal-field' },
    { type: 'computed-fields', id: 'local-hub::article-card::millenial-puppies::tag-names' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::tags' },
  ]);
  expect(includedIdentifiers).to.include.members([
    'fields/local-hub::article-card::millenial-puppies::title',
    'fields/local-hub::article-card::millenial-puppies::body',
    'fields/local-hub::article-card::millenial-puppies::author',
    'fields/local-hub::article-card::millenial-puppies::internal-field',
    'fields/local-hub::article-card::millenial-puppies::tags',
    'computed-fields/local-hub::article-card::millenial-puppies::tag-names',
    'content-types/local-hub::article-card::millenial-puppies::tags',
    'constraints/local-hub::article-card::millenial-puppies::title-not-null'
  ]);

  // Card does not include the primary model content type schema--as that is derived by the hub,
  // and there is really nothing that explicitly references it, so it wouldn't really make sense
  // to include anyways...
  expect(includedIdentifiers).to.not.include.members([
    'content-types/local-hub::article-card::millenial-puppies'
  ]);
}

describe('hub/card-services', function () {
  let env, cardServices;

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
      expect(error.source).to.eql({ pointer: `/data/relationships/local-hub::foreign-internal-belongs-to-relationship::bad::related-thing/data` });
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
      expect(error.source).to.eql({ pointer: `/data/relationships/local-hub::foreign-internal-has-many-relationship::bad::related-things/data/0` });
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

  describe("loads card", function () {
    describe("via indexer", function () {
      let indexers, changedCards = [];

      beforeEach(async function () {
        cleanup();
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources', 'stub-card-project')
          .withAttributes({
            sourceType: 'stub-card-project',
            params: {
              changedCards,
              cardSearchResults: [
                userCard,
              ]
            }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
        cardServices = env.lookup('hub:card-services');
        indexers = env.lookup('hub:indexers');
      });

      it("will load a card implicitly when an indexer processes a card document", async function () {
        changedCards.push(internalArticleCard);

        await indexers.update();

        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        assertIsolatedCardMetadata(article);
        assertCardModels(article);
        assertCardOnDisk();
      });
    });

    describe("via searcher", function() {
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

      it("will load a card implicitly when a searcher's get() hook returns a card document", async function () {
        // The underlying searchers#get will encounter a card that has not been loaded into the index.
        // The hub should be able to load cards that it discovers from searchers into the index.
        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        assertIsolatedCardMetadata(article);
        assertCardModels(article);
        assertCardOnDisk();
      });

      it("will load a card implicitly when a searcher's search() hook returns a card document in isolated format", async function () {
        let { data: [article] } = await cardServices.search(env.session, 'isolated', {
          filter: {
            type: { exact: 'cards' }
          }
        });

        assertIsolatedCardMetadata({ data: article });
        assertCardOnDisk();
      });

      // TODO move this into the search() tests after that is implemented
      it("will load a card implicitly when a searcher's search() hook returns a card document in embedded format", async function () {
        let { data: [article], included } = await cardServices.search(env.session, 'embedded', {
          filter: {
            type: { exact: 'cards' }
          }
        });

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

        expect(article.attributes.title).to.equal('The Millenial Puppy');
        expect(article.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh'});
        expect(article.attributes.body).to.be.undefined;
        expect(article.relationships.tags).to.be.undefined;
        expect(article.attributes['internal-field']).to.be.undefined;

        expect(includedIdentifiers).to.include.members([ 'cards/local-hub::user-card::van-gogh' ]);
        expect(includedIdentifiers).to.not.include.members([
          'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::millenials',
          'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::puppies',
          'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::belly-rubs',
        ]);

        assertCardOnDisk();
      });
    });
  });

  describe('writing cards', function() {
    let externalArticleCard;
    beforeEach(async function () {
      cleanup();
      let factory = new JSONAPIFactory();
      factory.addResource('data-sources', 'stub-card-project')
        .withAttributes({
          sourceType: 'stub-card-project',
          params: {
            cardSearchResults: [
              userCard,
            ]
          }
        });
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
      externalArticleCard = await adaptCardToFormat(await env.lookup('hub:current-schema').getSchema(), env.session, internalArticleCard, 'isolated', cardServices.get);

      // remove the card metadata to make this as real as possible...
      for (let field of Object.keys(externalArticleCard.data.attributes)) {
        if (cardBrowserAssetFields.includes(field)) { continue; }
        delete externalArticleCard.data.attributes[field];
      }
    });

    it('can add a new card', async function() {
      let card = await cardServices.create(env.session, externalArticleCard);

      assertCardOnDisk();
      assertIsolatedCardMetadata(card);
      assertCardModels(card);
      assertCardSchema(card);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      assertIsolatedCardMetadata(article);
    });

    it("does not allow missing card model when creating card", async function() {
      let missingModel = cloneDeep(externalArticleCard);
      delete missingModel.data.relationships.model;
      missingModel.included = missingModel.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies');

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

    it("does not allow a card to be created with a model whose type does not match the card id", async function() {
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

    it("does not allow a card to be created with a model specified but missing in the included resource", async function() {
      let error;
      try {
        let badArticle = cloneDeep(externalArticleCard);
        badArticle.included = badArticle.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies');
        await cardServices.create(env.session, badArticle);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/The specified card model .* is missing/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be created with a model whose id does not match the card id", async function() {
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

    it("can add a field to a card's schema", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.fields.data.push({ type: 'fields', id: 'local-hub::article-card::millenial-puppies::editor'});
      card.included.push({
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::editor',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        }
      });

      card = await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(includedIdentifiers).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(fieldRelationships).to.include('fields/local-hub::article-card::millenial-puppies::editor');

      card = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(includedIdentifiers).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(fieldRelationships).to.include('fields/local-hub::article-card::millenial-puppies::editor');
    });

    it("can remove a field from the card's schema", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.fields.data = card.data.relationships.fields.data.filter(i => i.id !== 'local-hub::article-card::millenial-puppies::body');
      card.included = card.included.filter(i => i.id !== 'local-hub::article-card::millenial-puppies::body');

      card = await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(card.data.attributes.body).to.be.undefined;
      expect(includedIdentifiers).to.not.include('fields/local-hub::article-card::millenial-puppies::body');
      expect(fieldRelationships).to.not.include('fields/local-hub::article-card::millenial-puppies::body');

      card = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(card.data.attributes.body).to.be.undefined;
      expect(includedIdentifiers).to.not.include('fields/local-hub::article-card::millenial-puppies::body');
      expect(fieldRelationships).to.not.include('fields/local-hub::article-card::millenial-puppies::body');
    });

    it("can update a card's internal model", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
      internalModel.attributes.body = 'updated body';

      card = await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');

      assertCardSchema(card);
      expect(card.data.attributes.body).to.equal('updated body');
      expect(internalModel.attributes.body).to.equal('updated body');

      card = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
      expect(card.data.attributes.body).to.equal('updated body');
      expect(internalModel.attributes.body).to.equal('updated body');
    });

    it("does not allow missing card model when updating card", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      delete card.data.relationships.model;
      card.included = card.included.filter(i => `${i.type}/${i.id}` !== 'local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies');

      let error;
      try {
        await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/is missing its card model/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("can update a card's schema and a card model at the same time", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
      internalModel.attributes.editor = 'Hassan';
      card.data.relationships.fields.data.push({ type: 'fields', id: 'local-hub::article-card::millenial-puppies::editor'});
      card.included.push({
        type: 'fields',
        id: 'local-hub::article-card::millenial-puppies::editor',
        attributes: {
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        }
      });

      card = await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      let { data, included } = card;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      let fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);

      expect(includedIdentifiers).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(fieldRelationships).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(card.data.attributes.editor).to.equal('Hassan');
      expect(internalModel.attributes.editor).to.equal('Hassan');

      card = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      data = card.data;
      included = card.included;
      includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      fieldRelationships = data.relationships.fields.data.map(i => `${i.type}/${i.id}`);
      expect(includedIdentifiers).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(fieldRelationships).to.include('fields/local-hub::article-card::millenial-puppies::editor');
      expect(card.data.attributes.editor).to.equal('Hassan');
      expect(internalModel.attributes.editor).to.equal('Hassan');
    });

    it('can delete a card', async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      let { data: { meta: { version } } } = card;
      await cardServices.delete(env.session, 'local-hub::article-card::millenial-puppies', version);

      let error;
      try {
        await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      } catch (e) {
        error = e;
      }
      expect(error.status).to.equal(404);
    });

    it.skip('can add a new related card field', async function () {
    });

    it("does not allow a card to be updated with a model whose type does not match the card id", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.model.data.type = 'local-hub::article-card::bad';
      let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
      internalModel.type = 'local-hub::article-card::bad';
      let error;
      try {
        await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
      } catch (e) {
        error = e;
      }

      expect(error.status).to.equal(400);
      expect(error.message).to.match(/card model does not match the card id/);
      expect(error.source).to.eql({ pointer: '/data/relationships/model/data' });
    });

    it("does not allow a card to be updated with a model whose id does not match the card id", async function() {
      let card = await cardServices.create(env.session, externalArticleCard);
      card.data.relationships.model.data.id = 'local-hub::article-card::bad';
      let internalModel = card.included.find(i => i.type = 'local-hub::article-card::millenial-puppies');
      internalModel.id = 'local-hub::article-card::bad';
      let error;
      try {
        await cardServices.update(env.session, 'local-hub::article-card::millenial-puppies', card);
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

      factory.addResource('data-sources', 'stub-card-project')
        .withAttributes({
          sourceType: 'stub-card-project',
          params: {
            cardSearchResults: [
              userCard,
              internalArticleCard
            ]
          }
        });

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
      cardServices = env.lookup('hub:card-services');
    });

    it("has card metadata for isolated format", async function () {
      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      assertIsolatedCardMetadata(article);
    });

    it("has card metadata for embedded format", async function () {
      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'embedded');
      assertEmbeddedCardMetadata(article);
    });

    it("has card models", async function () {
      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      assertCardModels(article);
    });

    it("has card schema", async function () {
      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      assertCardSchema(article);
    });

    it("has card browser assets", async function () {
      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
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

  describe.skip('search for card', function () {
    it("can search for a card", async function () {
      // TODO we should be able to leverage the card metadata as fields we can search against for a card
    });
  });

  describe.skip('read authorization', function() {
    it('does not return card metadata that the session does not have read authorization for', async function() {
    });

    it('does not contain included resource for card metadata relationship that the session does not have read authorization for', async function() {
    });
  });
});