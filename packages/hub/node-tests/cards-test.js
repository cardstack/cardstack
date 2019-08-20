const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');

const articleCard = require('./cards/article-card');
const anotherArticleCard = require('./cards/another-article-card');
const emptyArticleCard = require('./cards/no-model-article-card');
const foreignSchema = require('./cards/card-with-foreign-schema');
const foreignModelType = require('./cards/card-with-foreign-model-type');
const foreignModelId = require('./cards/card-with-foreign-model-id');
const mismatchedModelId = require('./cards/card-with-mismatched-model-id');
const foreignInternalRelationship = require('./cards/card-with-foreign-internal-relationship');

describe('hub/card-services', function () {
  let env, cardServices;

  afterEach(async function () {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  describe("loads card", function() {
    describe("card validation", function() {
      beforeEach(async function () {
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`);
        cardServices = env.lookup('hub:card-services');
      });

      it("does not allow card with foreign schema to be loaded", async function () {
        let error;
        try {
          await cardServices.loadCard(foreignSchema);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(400);
        expect(error.message).to.match(/foreign schema/);
        expect(error.source).to.eql({ pointer: 'data/relationships/fields'});
      });

      it("does not allow card with foreign model content-type to be loaded", async function () {
        let error;
        try {
          await cardServices.loadCard(foreignModelType);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(400);
        expect(error.message).to.match(/foreign schema/);
        expect(error.source).to.eql({ pointer: 'data/relationships/model'});
      });

      it("does not allow card with foreign model id to be loaded", async function () {
        let error;
        try {
          await cardServices.loadCard(foreignModelId);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(400);
        expect(error.message).to.match(/foreign model/);
        expect(error.source).to.eql({ pointer: 'data/relationships/model'});
      });

      it("does not allow card with id that does not match card id to be loadeed", async function () {
        let error;
        try {
          await cardServices.loadCard(mismatchedModelId);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(400);
        expect(error.message).to.match(/foreign model/);
        expect(error.source).to.eql({ pointer: 'data/relationships/model'});
      });

      // TODO should we allow internal model relationships between cards within the same package?
      // like can article-card A point to an internal model in article-card B?
      it("does not allow a card to have a relationship to another card's internal model to be loaded", async function () {
        let error;
        try {
          await cardServices.loadCard(foreignInternalRelationship);
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(400);
        expect(error.message).to.match(/internal model of foreign card/);
        expect(error.source).to.eql({ pointer: 'included/[local-hub::foreign-internal-relationship/local-hub::foreign-internal-relationship::bad]/relationships/related-thing'});
      });
    });

    describe("via indexer", function() {
      let indexers, changedCards = [];

      beforeEach(async function () {
        let factory = new JSONAPIFactory();

        factory.addResource('data-sources', 'stub-card-indexer')
          .withAttributes({
            sourceType: 'stub-card-project',
            params: { changedCards }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
        cardServices = env.lookup('hub:card-services');
        indexers = env.lookup('hub:indexers');
      });

      it("will load a card implicitly when an indexer processes a card document", async function () {
        changedCards.push(articleCard);

        await indexers.update();

        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        let { data } = article;

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      });
    });

    describe("via searcher", function() {
      beforeEach(async function () {
        let factory = new JSONAPIFactory();

        factory.addResource('data-sources', 'stub-card-searcher')
          .withAttributes({
            sourceType: 'stub-card-project',
            params: {
              cardSearchResults: [articleCard]
            }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`, factory.getModels());
        cardServices = env.lookup('hub:card-services');
      });

      it("will load a card implicitly when a searcher's get() hook returns a card document", async function () {
        // The underlying searchers#get will encounter a card that has not been loaded into the index.
        // The hub should be able to load cards that it discovers from searchers into the index.
        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        let { data } = article;

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      });

      it("will load a card implicitly when a searcher's search() hook returns a card document", async function () {
        let { data: [article] } = await cardServices.search(env.session, 'isolated', {
          filter: {
            type: { exact: 'cards' }
          }
        });

        expect(article.attributes.title).to.equal('The Millenial Puppy');
        expect(article.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      });
    });
  });

  describe('get card', function () {
    beforeEach(async function () {
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-project`);
      cardServices = env.lookup('hub:card-services');
    });

    it("has card metadata for isolated format", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data } = article;

      expect(data.attributes.title).to.equal('The Millenial Puppy');
      expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
      expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh'});
      expect(data.relationships.tags.data).to.eql([
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
      ]);
      expect(data.attributes['internal-field']).to.be.undefined;
    });

    it("has card metadata for embedded format", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'embedded');
      let { data, included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

      expect(data.attributes.title).to.equal('The Millenial Puppy');
      expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh'});
      expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
      expect(data.relationships.tags).to.be.undefined;
      expect(data.attributes.body).to.be.undefined;
      expect(data.attributes['internal-field']).to.be.undefined;

      expect(includedIdentifiers).to.not.include.members([
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::millenials',
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::puppies',
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::belly-rubs',
      ]);
    });

    it("has card models", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data, included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

      // Card includes backing internal models that are allowed to be included based on metadata visibility
      expect(data.relationships.model.data).to.eql({ type: 'local-hub::article-card', id: 'local-hub::article-card::millenial-puppies' });
      expect(includedIdentifiers).to.include.members(['local-hub::article-card/local-hub::article-card::millenial-puppies']);
      expect(includedIdentifiers).to.include.members([
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::millenials',
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::puppies',
        'local-hub::article-card::tags/local-hub::article-card::millenial-puppies::belly-rubs',
      ]);
    });

    // TODO should we include the schema for embedded cards as well in the card document?
    it("has card schema", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data, included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

      expect(data.relationships['fields'].data).to.eql([
        { type: 'fields', id: 'local-hub::article-card::title' },
        { type: 'fields', id: 'local-hub::article-card::author' },
        { type: 'fields', id: 'local-hub::article-card::body' },
        { type: 'fields', id: 'local-hub::article-card::internal-field' },
        { type: 'computed-fields', id: 'local-hub::article-card::tag-names' },
        { type: 'fields', id: 'local-hub::article-card::tags' },
      ]);
      expect(includedIdentifiers).to.include.members([
        'fields/local-hub::article-card::title',
        'fields/local-hub::article-card::body',
        'fields/local-hub::article-card::author',
        'fields/local-hub::article-card::internal-field',
        'fields/local-hub::article-card::tags',
        'computed-fields/local-hub::article-card::tag-names',
        'content-types/local-hub::article-card::tags',
        'constraints/local-hub::article-card::title-not-null'
      ]);

      // Card does not include the primary model content type schema--as that is derived by the hub,
      // and there is really nothing that explicitly references it, so it wouldn't really make sense
      // to include anyways...
      expect(includedIdentifiers).to.not.include.members([
        'content-types/local-hub::article-card'
      ]);
    });

    it('has included related embedded cards', async function() {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
      expect(includedIdentifiers).to.include.members([
        'cards/local-hub::user-card::van-gogh',
      ]);

      expect(includedIdentifiers).to.not.include.members([
        'local-hub::user-card/local-hub::user-card::van-gogh',
        'fields/local-hub::user-card::name',
        'fields/local-hub::user-card::email',
      ]);
      let card = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
      expect(card.attributes.name).to.equal('Van Gogh');
      expect(card.attributes.email).to.be.undefined;
    });

    it("has card browser assets", async function () {
      await cardServices.loadCard(articleCard);

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

    it('has card browser assets for related embedded cards', async function() {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { included } = article;
      let card = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
      expect(card.attributes['isolated-template']).to.match(/<div>\{\{this\.email\}\}<\/div>/);
      expect(card.attributes['embedded-template']).to.match(/<div>\{\{this\.name\}\}<\/div>/);
    });

    it('can load mulitple cards from the same package that have differing models', async function() {
      await cardServices.loadCard(articleCard);
      await cardServices.loadCard(anotherArticleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data } = article;

      expect(data.attributes.title).to.equal('The Millenial Puppy');
      expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
      expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh'});
      expect(data.relationships.tags.data).to.eql([
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
      ]);

      article = await cardServices.get(env.session, 'local-hub::article-card::plumber-blues', 'isolated');
      data = article.data;

      expect(data.attributes.title).to.equal('The Plumber Blues');
      expect(data.attributes.body).to.match(/Woe! Woe! Woe is me!/);
      expect(data.attributes['tag-names']).to.eql(['plumber', 'leaky-pipes', 'waiting']);
      expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh'});
      expect(data.relationships.tags.data).to.eql([
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::plumber-blues::plumber' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::plumber-blues::leaky-pipes' },
        { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::plumber-blues::waiting' },
      ]);
    });

    it('can support a card that has no model relationship explicitely specified (model is inferred)', async function() {
      await cardServices.loadCard(emptyArticleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::empty-article', 'isolated');
      let { data, included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

      expect(data.attributes.title).to.be.null;
      expect(data.relationships.author.data).to.be.notOk;
      expect(data.attributes['tag-names']).to.eql([]);
      expect(data.relationships.tags.data).to.eql([]);
      expect(data.attributes.body).to.be.null;
      expect(data.attributes['internal-field']).to.be.undefined;

      expect(data.relationships.model.data).to.eql({ type: 'local-hub::article-card', id: 'local-hub::article-card::empty-article' });
      expect(includedIdentifiers).to.include.members(['local-hub::article-card/local-hub::article-card::empty-article']);
    });
  });

  describe('search for card', function () {
    it.skip("can search for a card", async function () {
      // TODO we should be able to leverage the card metadata as fields we can search against for a card
    });

    it.skip("can not find a card when you search against its internal field", async function() {
    });
  });

  describe('read authorization', function() {
    let allowedUser, restrictedUser;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      // Grants are set against the model content type, as that
      // is where the meta fields actually live
      factory.addResource('grants')
        .withRelated('who', [{ type: 'groups', id: 'everyone'} ])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::article-card' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'local-hub::article-card::title' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });

      factory.addResource('grants')
        .withRelated('who', [ { type: 'test-users', id: 'allowed-user'} ])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::article-card' }
        ])
        .withRelated('fields', [
          { type: 'fields', id: 'local-hub::article-card::author' },
          { type: 'fields', id: 'local-hub::article-card::body' },
          { type: 'fields', id: 'local-hub::article-card::tag-names' },
          { type: 'fields', id: 'local-hub::article-card::tags' },
        ])
        .withAttributes({
          mayReadResource: true,
          mayReadFields: true
        });

      factory.addResource('grants')
        .withRelated('who', [ { type: 'test-users', id: 'allowed-user'} ])
        .withRelated('types', [
          { type: 'content-types', id: 'local-hub::user-card' }
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

      await cardServices.loadCard(articleCard);
    });

    describe('get()', function () {
      it('does not return card whose model content type the session does not have read authorization for', async function () {
        let error;
        try {
          await cardServices.get(restrictedUser, 'local-hub::user-card::van-gogh', 'isolated');
        } catch (e) {
          error = e;
        }
        expect(error.status).to.equal(404);
      });

      it('does return card whose model content type the session has read authorization for', async function () {
        let { data } = await cardServices.get(allowedUser, 'local-hub::user-card::van-gogh', 'isolated');

        expect(data.id).to.equal('local-hub::user-card::van-gogh');
        expect(data.type).to.equal('cards');
      });

      it('does not return card metadata that the session does not have read authorization for', async function () {
        let { data } = await cardServices.get(restrictedUser, 'local-hub::article-card::millenial-puppies', 'isolated');

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.relationships.author).to.be.undefined;
        expect(data.attributes['tag-names']).to.be.undefined;
        expect(data.relationships.tags).to.be.undefined;
        expect(data.attributes.body).to.be.undefined;
        expect(data.attributes['internal-field']).to.be.undefined;
      });

      it('does return card metadata that the session has read authorization for', async function () {
        let { data } = await cardServices.get(allowedUser, 'local-hub::article-card::millenial-puppies', 'isolated');

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(data.attributes['tag-names']).to.eql(['millenials', 'puppies', 'belly-rubs']);
        expect(data.relationships.author.data).to.eql({ type: 'cards', id: 'local-hub::user-card::van-gogh' });
        expect(data.relationships.tags.data).to.eql([
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
        ]);
        expect(data.attributes['internal-field']).to.be.undefined;
      });

      it('does not contain included resource for card metadata relationship that the session does not have read authorization for', async function () {
        let { included } = await cardServices.get(restrictedUser, 'local-hub::article-card::millenial-puppies', 'isolated');

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.not.include.members([
          'cards/local-hub::user-card::van-gogh',
        ]);
      });

      it('does contain included resource for card metadata relationship that the session does has read authorization for', async function () {
        let { included } = await cardServices.get(allowedUser, 'local-hub::article-card::millenial-puppies', 'isolated');

        let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
        expect(includedIdentifiers).to.include.members([
          'cards/local-hub::user-card::van-gogh',
        ]);

        expect(includedIdentifiers).to.not.include.members([
          'local-hub::user-card/local-hub::user-card::van-gogh',
          'fields/local-hub::user-card::name',
          'fields/local-hub::user-card::email',
        ]);
        let card = included.find(i => `${i.type}/${i.id}` === 'cards/local-hub::user-card::van-gogh');
        expect(card.attributes.name).to.equal('Van Gogh');
        expect(card.attributes.email).to.be.undefined;
      });
    });
    describe('search()', function () {
      it.skip('applies read authorization to card meta fields returned from search', async function() {
      });

      it.skip('does not include cards for which the session does not have read-resource permissions', async function() {
      });

      it.skip('does not include included resources for relationships fields that the session does not have read access to', async function() {
      });
    });
  });
});