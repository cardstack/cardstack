const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
let factory = new JSONAPIFactory();

let articleCard = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::article-card::millenial-puppies')
    .withAttributes({
      'isolated-template': `
        <h1>{{this.title}}</h1>
        <h3>By {{this.author}}</h3>
        <ul>
          {{#each this.tags as |tag|}}
            <li>{{tag.id}}</li>
          {{/each}}
        </ul>
        <div>{{this.body}}</div>
      `,
      'isolated-js': `
        import Component from '@glimmer/component';
        export default class ArticleIsolatedComponent extends Component {};
      `,
      'isolated-css': `
        .article-card-isolated {}
      `,
      'embedded-template': `
        <h3>{{this.title}}</h3>
        <p>By {{this.author}}</p>
      `,
      'embedded-js': `
        import Component from '@glimmer/component';
        export default class ArticleEmbeddedComponent extends Component {};
      `,
      'embedded-css': `
        .article-card-embedded {}
      `,
      // Note that we're not explicitly specifying the card metadata. The card should be able
      // generate its metadata based on the fields that we have defined for the card and
      // the model data that we have specified for the card.
    })
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::article-card::title').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string' //TODO rework for fields-as-cards
      }).withRelated('constraints', [
        factory.addResource('constraints', 'local-hub::article-card::title-not-null')
          .withAttributes({
            'constraint-type': '@cardstack/core-types::not-null',
            'error-message': 'The title must not be empty.'
          })
      ]),
      factory.addResource('fields', 'local-hub::article-card::author').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'local-hub::article-card::body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'local-hub::article-card::internal-field').withAttributes({
        'field-type': '@cardstack/core-types::string'
      }),

      // TODO is this a legit scenario where a card has a metadata relationship field
      // to an internal model? Maybe instead, cards' metadata relationships can only be to other cards?
      // Maybe a better test involving relationships to internal models would be to consume
      // this relationship in a computed that is a metadata field (and probably we
      // should have a test that involves a card that has a relationship to another card).
      factory.addResource('fields', 'local-hub::article-card::tags').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        // this is modeling an enumeration using a private model.
        // this content type name will be prefixed with the card's
        // package and card name, such that other cards can also
        // have their own 'tags' internal content types.
        factory.addResource('content-types', 'local-hub::article-card::tags')
      ]),
    ])

    .withRelated('model', factory.addResource('local-hub::article-card', 'local-hub::article-card::millenial-puppies')
      .withAttributes({
        'internal-field': 'this is internal data',
        'title': 'The Millenial Puppy',
        'author': 'Van Gogh',
        'body': `
            It can be difficult these days to deal with the
            discerning tastes of the millenial puppy. In this
            article we probe the needs and desires of millenial
            puppies and why they love belly rubs so much.
          `
      })
      .withRelated('tags', [
        // Note that the tags models will be prefixed with this card's ID
        // such that you will never run into model collisions for tags
        // of different article cards
        factory.addResource('local-hub::article-card::tags', 'local-hub::article-card::millenial-puppies::millenials'),
        factory.addResource('local-hub::article-card::tags', 'local-hub::article-card::millenial-puppies::puppies'),
        factory.addResource('local-hub::article-card::tags', 'local-hub::article-card::millenial-puppies::belly-rubs'),
      ])
    )
  );

describe('hub/card-services', function () {
  let env, cardServices;

  afterEach(async function () {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  describe("loads card", function() {
    describe("validation", function() {
      beforeEach(async function () {
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`);
        cardServices = env.lookup('hub:card-services');
      });

      it.skip("validates that the card's internal models belong to the card--no funny business", async function () {
      });

      it.skip("validates that the card's internal models don't fashion relationships to the internal models of foreign cards", async function () {
      });
    });

    describe("via indexer", function() {
      let indexers, changedCards = [];

      beforeEach(async function () {
        let initialFactory = new JSONAPIFactory();

        initialFactory.addResource('data-sources', 'stub-card-indexer')
          .withAttributes({
            sourceType: 'stub-card-indexer',
            params: { changedCards }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-indexer`, initialFactory.getModels());
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
        expect(data.attributes.author).to.equal('Van Gogh');
        expect(data.relationships.tags.data).to.eql([
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
        ]);
      });
    });

    describe("via searcher", function() {
      beforeEach(async function () {
        let initialFactory = new JSONAPIFactory();

        initialFactory.addResource('data-sources', 'stub-card-searcher')
          .withAttributes({
            sourceType: 'stub-card-searcher',
            params: {
              cardSearchResults: [articleCard]
            }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-searcher`, initialFactory.getModels());
        cardServices = env.lookup('hub:card-services');
      });

      it("will load a card implicitly when a searcher's get() hook returns a card document", async function () {
        // The underlying searchers#get will encounter a card that has not been loaded into the index.
        // The hub should be able to load cards that it discovers from searchers into the index.
        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        let { data } = article;

        expect(data.attributes.title).to.equal('The Millenial Puppy');
        expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(data.attributes.author).to.equal('Van Gogh');
        expect(data.relationships.tags.data).to.eql([
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
        ]);
      });

      it("will load a card implicitly when a searcher's search() hook returns a card document", async function () {
        let { data: [article] } = await cardServices.search(env.session, 'isolated', {
          filter: {
            type: { exact: 'cards' }
          }
        });

        expect(article.attributes.title).to.equal('The Millenial Puppy');
        expect(article.attributes.body).to.match(/discerning tastes of the millenial puppy/);
        expect(article.attributes.author).to.equal('Van Gogh');
        expect(article.relationships.tags.data).to.eql([
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::millenials' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::puppies' },
          { type: 'local-hub::article-card::tags', id: 'local-hub::article-card::millenial-puppies::belly-rubs' },
        ]);
      });
    });
  });

  describe('get card', function () {
    beforeEach(async function () {
      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`);
      cardServices = env.lookup('hub:card-services');
    });

    it("has card metadata for isolated format", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data } = article;

      expect(data.attributes.title).to.equal('The Millenial Puppy');
      expect(data.attributes.body).to.match(/discerning tastes of the millenial puppy/);
      expect(data.attributes.author).to.equal('Van Gogh');
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
      expect(data.attributes.author).to.equal('Van Gogh');
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

    it("has card schema", async function () {
      await cardServices.loadCard(articleCard);

      let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
      let { data, included } = article;
      let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

      expect(data.relationships.fields.data).to.eql([
        { type: 'fields', id: 'local-hub::article-card::title' },
        { type: 'fields', id: 'local-hub::article-card::author' },
        { type: 'fields', id: 'local-hub::article-card::body' },
        { type: 'fields', id: 'local-hub::article-card::internal-field' },
        { type: 'fields', id: 'local-hub::article-card::tags' },
      ]);
      expect(includedIdentifiers).to.include.members([
        'fields/local-hub::article-card::title',
        'fields/local-hub::article-card::body',
        'fields/local-hub::article-card::author',
        'fields/local-hub::article-card::internal-field',
        'fields/local-hub::article-card::tags',
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

    it.skip("has card metadata computed fields", async function() {
    });

    it.skip("has card metadata relationship to another card", async function() {
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