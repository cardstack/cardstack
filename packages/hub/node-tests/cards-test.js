const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const { removeSync, pathExistsSync } = require('fs-extra');
const { readFileSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { adaptCardToFormat, cardBrowserAssetFields } = require('../indexing/card-utils');

let cardFactory = new JSONAPIFactory();
// This is the internal representation of a card. Browser clients do not
// encounter this form of a card. Look at the jsonapi tests and browser
// tests for the structure of a card as it is known externally.
let internalArticleCard = cardFactory.getDocumentFor(
  cardFactory.addResource('local-hub::article-card::millenial-puppies', 'local-hub::article-card::millenial-puppies')
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
      'local-hub::article-card::millenial-puppies::internal-field': 'this is internal data',
      'local-hub::article-card::millenial-puppies::title': 'The Millenial Puppy',
      'local-hub::article-card::millenial-puppies::author': 'Van Gogh',
      'local-hub::article-card::millenial-puppies::body': `
        It can be difficult these days to deal with the
        discerning tastes of the millenial puppy. In this
        article we probe the needs and desires of millenial
        puppies and why they love belly rubs so much.
      `
    })
    .withRelated('fields', [
      cardFactory.addResource('fields', 'local-hub::article-card::millenial-puppies::title').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string' //TODO rework for fields-as-cards
      }).withRelated('constraints', [
        cardFactory.addResource('constraints', 'local-hub::article-card::millenial-puppies::title-not-null')
          .withAttributes({
            'constraint-type': '@cardstack/core-types::not-null',
            'error-message': 'The title must not be empty.'
          })
      ]),
      cardFactory.addResource('fields', 'local-hub::article-card::millenial-puppies::author').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      }),
      cardFactory.addResource('fields', 'local-hub::article-card::millenial-puppies::body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
      cardFactory.addResource('fields', 'local-hub::article-card::millenial-puppies::internal-field').withAttributes({
        'field-type': '@cardstack/core-types::string'
      }),

      // TODO is this a legit scenario where a card has a metadata relationship field
      // to an internal model? Maybe instead, cards' metadata relationships can only be to other cards?
      // Maybe a better test involving relationships to internal models would be to consume
      // this relationship in a computed that is a metadata field (and probably we
      // should have a test that involves a card that has a relationship to another card).
      cardFactory.addResource('fields', 'local-hub::article-card::millenial-puppies::tags').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        // this is modeling an enumeration using a private model.
        // this content type name will be prefixed with the card's
        // package and card name, such that other cards can also
        // have their own 'tags' internal content types.
        cardFactory.addResource('content-types', 'local-hub::article-card::millenial-puppies::tags')
      ]),
    ])
    .withRelated('local-hub::article-card::millenial-puppies::tags', [
      // Note that the tags models will be prefixed with this card's ID
      // such that you will never run into model collisions for tags
      // of different article cards
      cardFactory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::millenials'),
      cardFactory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::puppies'),
      cardFactory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::belly-rubs'),
    ])
);

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
  expect(data.attributes.author).to.equal('Van Gogh');
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
  expect(data.attributes.author).to.equal('Van Gogh');
  expect(data.relationships.tags).to.be.undefined;
  expect(data.attributes.body).to.be.undefined;
  expect(data.attributes['internal-field']).to.be.undefined;

  expect(includedIdentifiers).to.not.include.members([
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::millenials',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::puppies',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::belly-rubs',
  ]);
}

function assertCardModels(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);
  expect(data.relationships.model.data).to.eql({ type: 'local-hub::article-card::millenial-puppies', id: 'local-hub::article-card::millenial-puppies' });
  expect(includedIdentifiers).to.include.members(['local-hub::article-card::millenial-puppies/local-hub::article-card::millenial-puppies']);
  expect(includedIdentifiers).to.include.members([
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::millenials',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::puppies',
    'local-hub::article-card::millenial-puppies::tags/local-hub::article-card::millenial-puppies::belly-rubs',
  ]);
}

function assertCardSchema(card) {
  let { data, included } = card;
  let includedIdentifiers = included.map(i => `${i.type}/${i.id}`);

  expect(data.relationships.fields.data).to.eql([
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::title' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::author' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::body' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::internal-field' },
    { type: 'fields', id: 'local-hub::article-card::millenial-puppies::tags' },
  ]);
  expect(includedIdentifiers).to.include.members([
    'fields/local-hub::article-card::millenial-puppies::title',
    'fields/local-hub::article-card::millenial-puppies::body',
    'fields/local-hub::article-card::millenial-puppies::author',
    'fields/local-hub::article-card::millenial-puppies::internal-field',
    'fields/local-hub::article-card::millenial-puppies::tags',
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
        cleanup();
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
        changedCards.push(internalArticleCard);

        await indexers.update();

        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        assertIsolatedCardMetadata(article);
        assertCardOnDisk();
      });
    });

    describe("via searcher", function() {
      beforeEach(async function () {
        cleanup();
        let initialFactory = new JSONAPIFactory();

        initialFactory.addResource('data-sources', 'stub-card-searcher')
          .withAttributes({
            sourceType: 'stub-card-searcher',
            params: {
              cardSearchResults: [internalArticleCard]
            }
          });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-searcher`, initialFactory.getModels());
        cardServices = env.lookup('hub:card-services');
      });

      it("will load a card implicitly when a searcher's get() hook returns a card document", async function () {
        // The underlying searchers#get will encounter a card that has not been loaded into the index.
        // The hub should be able to load cards that it discovers from searchers into the index.
        let article = await cardServices.get(env.session, 'local-hub::article-card::millenial-puppies', 'isolated');
        assertIsolatedCardMetadata(article);
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
        expect(article.attributes.author).to.equal('Van Gogh');
        expect(article.attributes.body).to.be.undefined;
        expect(article.relationships.tags).to.be.undefined;
        expect(article.attributes['internal-field']).to.be.undefined;

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

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`);
      cardServices = env.lookup('hub:card-services');
      externalArticleCard = await adaptCardToFormat(await env.lookup('hub:current-schema').getSchema(), internalArticleCard, 'isolated');

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

    it.skip('can update card data', async function() {
    });

    it.skip('can update card schema', async function() {
    });

    it.skip('can update card schema and data', async function() {
    });
  });

  describe('get card', function () {
    beforeEach(async function () {
      cleanup();
      let initialFactory = new JSONAPIFactory();

      initialFactory.addResource('data-sources', 'stub-card-searcher')
        .withAttributes({
          sourceType: 'stub-card-searcher',
          params: {
            cardSearchResults: [internalArticleCard]
          }
        });

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-card-searcher`, initialFactory.getModels());
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